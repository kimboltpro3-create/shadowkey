import { supabase } from './supabase';
import { encryptData, decryptData, generateAccessToken } from './crypto';
import {
  registerPolicyOnChain,
  revokePolicyOnChain,
  logDisclosureOnChain,
  updateBudgetOnChain,
  isContractAvailable,
} from './contract';
import type {
  Policy, DisclosureLog, VaultSecret, SecretField, ScopedAccess, SecretCategory,
  PrivacyBudget, EphemeralPersona, DeadManSwitch, ReverseDisclosureRequest,
} from '../types';

export async function getOrCreateVault(ownerAddress: string): Promise<string> {
  const normalizedAddress = ownerAddress.toLowerCase();

  // First, try to get existing vault
  const { data: existing } = await supabase
    .from('vaults')
    .select('id')
    .eq('owner_address', normalizedAddress)
    .maybeSingle();

  if (existing) return existing.id;

  // If not found, try to create
  const { data: newVault, error: insertError } = await supabase
    .from('vaults')
    .insert({ owner_address: normalizedAddress })
    .select('id')
    .maybeSingle();

  if (newVault) return newVault.id;

  // If insert failed due to race condition, fetch again
  if (insertError) {
    const { data: raceVault } = await supabase
      .from('vaults')
      .select('id')
      .eq('owner_address', normalizedAddress)
      .maybeSingle();

    if (raceVault) return raceVault.id;
    throw new Error(`Failed to create vault: ${insertError.message}`);
  }

  throw new Error('Failed to retrieve vault after creation');
}

export async function storeSecret(
  vaultId: string,
  category: SecretCategory,
  label: string,
  fields: SecretField[],
  password: string
): Promise<VaultSecret> {
  const plaintext = JSON.stringify(fields);
  const { ciphertext, iv, salt } = await encryptData(plaintext, password);

  const { data, error } = await supabase
    .from('encrypted_secrets')
    .insert({ vault_id: vaultId, category, label, ciphertext, iv, salt })
    .select()
    .single();

  if (error) throw new Error(`Failed to store secret: ${error.message}`);
  return data;
}

export async function loadSecrets(vaultId: string): Promise<VaultSecret[]> {
  const { data, error } = await supabase
    .from('encrypted_secrets')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load secrets: ${error.message}`);
  return data || [];
}

export async function deleteSecret(secretId: string, vaultId: string): Promise<void> {
  const { error } = await supabase
    .from('encrypted_secrets')
    .delete()
    .eq('id', secretId)
    .eq('vault_id', vaultId);
  if (error) throw new Error(`Failed to delete secret: ${error.message}`);
}

export async function decryptSecret(secret: VaultSecret, password: string): Promise<SecretField[]> {
  const plaintext = await decryptData(secret.ciphertext, secret.iv, secret.salt, password);
  return JSON.parse(plaintext);
}

export async function createPolicy(
  vaultId: string,
  policy: Omit<Policy, 'id' | 'vault_id' | 'total_spent' | 'created_at'>
): Promise<Policy> {
  const { data, error } = await supabase
    .from('policies')
    .insert({
      vault_id: vaultId,
      agent_address: policy.agent_address.toLowerCase(),
      agent_alias: policy.agent_alias,
      category: policy.category,
      spend_limit: policy.spend_limit,
      total_limit: policy.total_limit,
      total_spent: 0,
      allowed_services: policy.allowed_services.map((s) => s.toLowerCase()),
      expires_at: policy.expires_at,
      reveal_fields: policy.reveal_fields,
      hidden_fields: policy.hidden_fields,
      active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create policy: ${error.message}`);

  // Dual-write: register on-chain (non-blocking — Supabase is source of truth)
  try {
    if (await isContractAvailable()) {
      const txHash = await registerPolicyOnChain(
        data.id,
        data.agent_address,
        data.category,
        data.spend_limit,
        data.total_limit,
        new Date(data.expires_at),
        data.allowed_services,
        data.reveal_fields,
        data.hidden_fields,
      );
      if (txHash) {
        await supabase.from('policies').update({ tx_hash: txHash }).eq('id', data.id);
        data.tx_hash = txHash;
      }
    }
  } catch (e) {
    console.warn('On-chain policy registration failed (Supabase write succeeded):', e);
  }

  return data;
}

export async function loadPolicies(vaultId: string): Promise<Policy[]> {
  const { data, error } = await supabase
    .from('policies')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load policies: ${error.message}`);
  return data || [];
}

export async function revokePolicy(policyId: string): Promise<void> {
  const { error } = await supabase.from('policies').update({ active: false }).eq('id', policyId);
  if (error) throw new Error(`Failed to revoke policy: ${error.message}`);

  // Dual-write: revoke on-chain
  try {
    if (await isContractAvailable()) {
      await revokePolicyOnChain(policyId);
    }
  } catch (e) {
    console.warn('On-chain policy revocation failed (Supabase write succeeded):', e);
  }
}

export async function revokeAllAgentPolicies(vaultId: string, agentAddress: string): Promise<void> {
  const { error } = await supabase
    .from('policies')
    .update({ active: false })
    .eq('vault_id', vaultId)
    .eq('agent_address', agentAddress.toLowerCase());

  if (error) throw new Error(`Failed to revoke agent policies: ${error.message}`);
}

export async function requestAccess(
  vaultId: string,
  agentAddress: string,
  category: SecretCategory,
  serviceAddress: string,
  requestedAmount: number,
  password: string
): Promise<ScopedAccess | null> {
  const { data: policies } = await supabase
    .from('policies')
    .select('*')
    .eq('vault_id', vaultId)
    .eq('agent_address', agentAddress.toLowerCase())
    .eq('category', category)
    .eq('active', true);

  if (!policies || policies.length === 0) return null;

  const now = new Date();
  const policy = policies.find((p: Policy) => {
    const notExpired = new Date(p.expires_at) > now;
    const serviceAllowed =
      p.allowed_services.length === 0 ||
      p.allowed_services.includes(serviceAddress.toLowerCase()) ||
      p.allowed_services.includes('any');
    const withinSpendLimit = requestedAmount <= p.spend_limit || p.spend_limit === 0;
    const withinTotalLimit = p.total_limit === 0 || p.total_spent + requestedAmount <= p.total_limit;
    return notExpired && serviceAllowed && withinSpendLimit && withinTotalLimit;
  });

  if (!policy) return null;

  // Atomically increment budget BEFORE decryption to prevent race conditions
  if (requestedAmount > 0) {
    const { data: updateResult, error: updateError } = await supabase
      .rpc('atomic_increment_policy_spend', {
        p_policy_id: policy.id,
        p_amount: requestedAmount,
      })
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update spend: ${updateError.message}`);
    }

    if (!updateResult || !(updateResult as { success?: boolean }).success) {
      throw new Error('Budget limit exceeded - request denied');
    }
  }

  // Only decrypt secrets after budget is confirmed
  const secrets = await loadSecrets(vaultId);
  const categorySecret = secrets.find((s: VaultSecret) => s.category === category);
  if (!categorySecret) return null;

  const allFields = await decryptSecret(categorySecret, password);
  const scopedFields = allFields.filter((f) => policy.reveal_fields.includes(f.key));

  return {
    token: generateAccessToken(),
    agent: agentAddress,
    category,
    fields: scopedFields,
    expires_at: policy.expires_at,
  };
}

export async function logDisclosure(
  vaultId: string,
  agentAddress: string,
  agentAlias: string | undefined,
  category: SecretCategory,
  serviceAddress: string,
  details: object,
  password: string,
  amount?: number
): Promise<DisclosureLog> {
  const { ciphertext, iv, salt } = await encryptData(JSON.stringify(details), password);

  const { data, error } = await supabase
    .from('disclosure_logs')
    .insert({
      vault_id: vaultId,
      agent_address: agentAddress.toLowerCase(),
      agent_alias: agentAlias,
      category,
      service_address: serviceAddress.toLowerCase(),
      encrypted_details: ciphertext,
      details_iv: iv,
      details_salt: salt,
      amount: amount ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log disclosure: ${error.message}`);

  // Dual-write: log disclosure on-chain
  try {
    if (await isContractAvailable()) {
      const txHash = await logDisclosureOnChain(
        data.id,
        serviceAddress,
        amount ?? 0,
        ciphertext,
      );
      if (txHash) {
        await supabase.from('disclosure_logs').update({ tx_hash: txHash }).eq('id', data.id);
        data.tx_hash = txHash;
      }
    }
  } catch (e) {
    console.warn('On-chain disclosure log failed (Supabase write succeeded):', e);
  }

  return data;
}

export async function loadDisclosureLogs(vaultId: string): Promise<DisclosureLog[]> {
  const { data, error } = await supabase
    .from('disclosure_logs')
    .select('*')
    .eq('vault_id', vaultId)
    .order('timestamp', { ascending: false });

  if (error) throw new Error(`Failed to load disclosure logs: ${error.message}`);
  return data || [];
}

export async function loadBudgets(vaultId: string): Promise<PrivacyBudget[]> {
  const { data, error } = await supabase
    .from('privacy_budgets')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load budgets: ${error.message}`);
  return data || [];
}

export async function upsertBudget(
  vaultId: string,
  category: SecretCategory,
  budget: Partial<PrivacyBudget>
): Promise<PrivacyBudget> {
  const { data: existing } = await supabase
    .from('privacy_budgets')
    .select('*')
    .eq('vault_id', vaultId)
    .eq('category', category)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('privacy_budgets')
      .update({
        max_disclosures_per_day: budget.max_disclosures_per_day ?? existing.max_disclosures_per_day,
        max_disclosures_per_week: budget.max_disclosures_per_week ?? existing.max_disclosures_per_week,
        max_unique_services: budget.max_unique_services ?? existing.max_unique_services,
        max_spend_per_day: budget.max_spend_per_day ?? existing.max_spend_per_day,
        alert_threshold_pct: budget.alert_threshold_pct ?? existing.alert_threshold_pct,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update budget: ${error.message}`);

    // Dual-write: update budget on-chain
    try {
      if (await isContractAvailable()) {
        await updateBudgetOnChain(
          category,
          data.max_disclosures_per_day,
          data.max_disclosures_per_week,
          data.max_unique_services,
          data.max_spend_per_day,
          data.alert_threshold_pct,
        );
      }
    } catch (e) {
      console.warn('On-chain budget update failed (Supabase write succeeded):', e);
    }

    return data;
  }

  const { data, error } = await supabase
    .from('privacy_budgets')
    .insert({
      vault_id: vaultId,
      category,
      max_disclosures_per_day: budget.max_disclosures_per_day ?? 10,
      max_disclosures_per_week: budget.max_disclosures_per_week ?? 50,
      max_unique_services: budget.max_unique_services ?? 5,
      max_spend_per_day: budget.max_spend_per_day ?? 0,
      alert_threshold_pct: budget.alert_threshold_pct ?? 80,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create budget: ${error.message}`);

  // Dual-write: update budget on-chain
  try {
    if (await isContractAvailable()) {
      await updateBudgetOnChain(
        category,
        data.max_disclosures_per_day,
        data.max_disclosures_per_week,
        data.max_unique_services,
        data.max_spend_per_day,
        data.alert_threshold_pct,
      );
    }
  } catch (e) {
    console.warn('On-chain budget update failed (Supabase write succeeded):', e);
  }

  return data;
}

export async function loadPersonas(vaultId: string): Promise<EphemeralPersona[]> {
  const { data, error } = await supabase
    .from('ephemeral_personas')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load personas: ${error.message}`);
  return data || [];
}

export async function createPersona(
  vaultId: string,
  policyId: string | null,
  alias: string,
  mappedFields: Record<string, string>,
  expiresAt: string
): Promise<EphemeralPersona> {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const personaAddress = `0x${hex}`;

  const { data, error } = await supabase
    .from('ephemeral_personas')
    .insert({
      vault_id: vaultId,
      policy_id: policyId,
      persona_alias: alias,
      persona_address: personaAddress,
      mapped_fields: mappedFields,
      active: true,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create persona: ${error.message}`);
  return data;
}

export async function deactivatePersona(personaId: string): Promise<void> {
  const { error } = await supabase
    .from('ephemeral_personas')
    .update({ active: false })
    .eq('id', personaId);
  if (error) throw new Error(`Failed to deactivate persona: ${error.message}`);
}

export async function loadDeadManSwitch(vaultId: string): Promise<DeadManSwitch | null> {
  const { data, error } = await supabase
    .from('dead_man_switches')
    .select('*')
    .eq('vault_id', vaultId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load dead man switch: ${error.message}`);
  return data;
}

export async function upsertDeadManSwitch(
  vaultId: string,
  config: Partial<DeadManSwitch>
): Promise<DeadManSwitch> {
  const { data: existing } = await supabase
    .from('dead_man_switches')
    .select('*')
    .eq('vault_id', vaultId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('dead_man_switches')
      .update({
        check_in_interval_hours: config.check_in_interval_hours ?? existing.check_in_interval_hours,
        auto_revoke_all: config.auto_revoke_all ?? existing.auto_revoke_all,
        notify_before_hours: config.notify_before_hours ?? existing.notify_before_hours,
        active: config.active ?? existing.active,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update dead man switch: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('dead_man_switches')
    .insert({
      vault_id: vaultId,
      check_in_interval_hours: config.check_in_interval_hours ?? 168,
      auto_revoke_all: config.auto_revoke_all ?? true,
      notify_before_hours: config.notify_before_hours ?? 24,
      active: true,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create dead man switch: ${error.message}`);
  return data;
}

export async function checkInDeadManSwitch(vaultId: string): Promise<void> {
  const { error } = await supabase
    .from('dead_man_switches')
    .update({ last_check_in: new Date().toISOString(), triggered: false })
    .eq('vault_id', vaultId);
  if (error) throw new Error(`Failed to check in: ${error.message}`);
}

export async function triggerDeadManSwitch(vaultId: string): Promise<void> {
  const { error: switchError } = await supabase
    .from('dead_man_switches')
    .update({ triggered: true })
    .eq('vault_id', vaultId);

  if (switchError) throw new Error(`Failed to trigger dead man switch: ${switchError.message}`);

  const { error: policyError } = await supabase
    .from('policies')
    .update({ active: false })
    .eq('vault_id', vaultId);

  if (policyError) throw new Error(`Failed to revoke policies: ${policyError.message}`);

  const { error: personaError } = await supabase
    .from('ephemeral_personas')
    .update({ active: false })
    .eq('vault_id', vaultId);

  if (personaError) throw new Error(`Failed to deactivate personas: ${personaError.message}`);
}

export async function loadReverseRequests(vaultId: string): Promise<ReverseDisclosureRequest[]> {
  const { data, error } = await supabase
    .from('reverse_disclosure_requests')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load reverse requests: ${error.message}`);
  return data || [];
}

export async function createReverseRequest(
  vaultId: string,
  req: Omit<ReverseDisclosureRequest, 'id' | 'vault_id' | 'status' | 'response_fields' | 'responded_at' | 'created_at'>
): Promise<ReverseDisclosureRequest> {
  const { data, error } = await supabase
    .from('reverse_disclosure_requests')
    .insert({
      vault_id: vaultId,
      service_address: req.service_address.toLowerCase(),
      service_name: req.service_name,
      requested_fields: req.requested_fields,
      justification: req.justification,
      category: req.category,
      status: 'pending',
      expires_at: req.expires_at,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create reverse request: ${error.message}`);
  return data;
}

export async function respondToReverseRequest(
  requestId: string,
  status: 'approved' | 'denied',
  responseFields: string[] = []
): Promise<void> {
  const { error } = await supabase
    .from('reverse_disclosure_requests')
    .update({
      status,
      response_fields: responseFields,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (error) throw new Error(`Failed to respond to request: ${error.message}`);
}

export async function getBudgetUsageFromServer(
  vaultId: string,
  category: SecretCategory
): Promise<{ disclosures_today: number; disclosures_this_week: number; unique_services: number; spend_today: number }> {
  const { data, error } = await supabase.rpc('get_budget_usage', {
    p_vault_id: vaultId,
    p_category: category,
  });
  if (error) throw new Error(`Failed to get budget usage: ${error.message}`);
  return data;
}

export async function checkBudgetFromServer(
  vaultId: string,
  category: SecretCategory
): Promise<{ allowed: boolean; reason: string; usage: Record<string, number>; budget: Record<string, number> | null }> {
  const { data, error } = await supabase.rpc('check_budget_limit', {
    p_vault_id: vaultId,
    p_category: category,
  });
  if (error) throw new Error(`Failed to check budget: ${error.message}`);
  return data;
}

export async function validateAccessFromServer(
  vaultId: string,
  agentAddress: string,
  category: SecretCategory,
  serviceAddress: string,
  amount: number = 0
): Promise<{ allowed: boolean; policy_id?: string; reveal_fields?: string[]; reason?: string; details?: string }> {
  const { data, error } = await supabase.rpc('validate_access_request', {
    p_vault_id: vaultId,
    p_agent_address: agentAddress.toLowerCase(),
    p_category: category,
    p_service_address: serviceAddress.toLowerCase(),
    p_amount: amount,
  });
  if (error) throw new Error(`Failed to validate access: ${error.message}`);
  return data;
}

export async function revokeAllVaultAccess(vaultId: string): Promise<{ policies: number; personas: number }> {
  const { data: policies, error: policiesError } = await supabase
    .from('policies')
    .update({ active: false })
    .eq('vault_id', vaultId)
    .eq('active', true)
    .select('id');

  if (policiesError) {
    throw new Error(`Failed to revoke policies: ${policiesError.message}`);
  }

  const { data: personas, error: personasError } = await supabase
    .from('ephemeral_personas')
    .update({ active: false })
    .eq('vault_id', vaultId)
    .eq('active', true)
    .select('id');

  if (personasError) {
    throw new Error(`Failed to revoke personas: ${personasError.message}`);
  }

  return {
    policies: policies?.length || 0,
    personas: personas?.length || 0,
  };
}

export async function getVaultStats(vaultId: string): Promise<{
  secrets: number;
  activePolicies: number;
  activePersonas: number;
  totalDisclosures: number;
  weeklyDisclosures: number;
  pendingRequests: number;
  deadManActive: boolean;
  budgetsSet: number;
}> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [secrets, policies, personas, allLogs, weekLogs, requests, deadMan, budgets] = await Promise.all([
    supabase.from('encrypted_secrets').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId),
    supabase.from('policies').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId).eq('active', true),
    supabase.from('ephemeral_personas').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId).eq('active', true),
    supabase.from('disclosure_logs').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId),
    supabase.from('disclosure_logs').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId).gte('timestamp', weekAgo),
    supabase.from('reverse_disclosure_requests').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId).eq('status', 'pending'),
    supabase.from('dead_man_switches').select('active').eq('vault_id', vaultId).maybeSingle(),
    supabase.from('privacy_budgets').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId),
  ]);

  return {
    secrets: secrets.count || 0,
    activePolicies: policies.count || 0,
    activePersonas: personas.count || 0,
    totalDisclosures: allLogs.count || 0,
    weeklyDisclosures: weekLogs.count || 0,
    pendingRequests: requests.count || 0,
    deadManActive: deadMan.data?.active || false,
    budgetsSet: budgets.count || 0,
  };
}
