import { supabase } from './supabase';
import type { Policy, SimulationResult, SecretCategory, EphemeralPersona } from '../types';

export async function simulateAccess(
  vaultId: string,
  policy: Policy,
  serviceAddress: string,
  amount: number
): Promise<SimulationResult> {
  if (!policy.active) {
    return {
      access: 'denied',
      reason: 'Policy is revoked',
      reveal_fields: [],
      hidden_fields: policy.hidden_fields,
      persona_fields: null,
      budget_impact: null,
      spend_impact: null,
    };
  }

  if (new Date(policy.expires_at) < new Date()) {
    return {
      access: 'denied',
      reason: 'Policy has expired',
      reveal_fields: [],
      hidden_fields: policy.hidden_fields,
      persona_fields: null,
      budget_impact: null,
      spend_impact: null,
    };
  }

  const normalizedService = serviceAddress.toLowerCase();
  const serviceAllowed =
    policy.allowed_services.length === 0 ||
    policy.allowed_services.includes('any') ||
    policy.allowed_services.map((s) => s.toLowerCase()).includes(normalizedService);

  if (!serviceAllowed) {
    return {
      access: 'denied',
      reason: `Service ${serviceAddress} is not in the allowed list`,
      reveal_fields: [],
      hidden_fields: policy.hidden_fields,
      persona_fields: null,
      budget_impact: null,
      spend_impact: null,
    };
  }

  if (policy.spend_limit > 0 && amount > policy.spend_limit) {
    return {
      access: 'denied',
      reason: `Amount $${amount} exceeds per-transaction limit of $${policy.spend_limit}`,
      reveal_fields: [],
      hidden_fields: policy.hidden_fields,
      persona_fields: null,
      budget_impact: null,
      spend_impact: null,
    };
  }

  if (policy.total_limit > 0 && policy.total_spent + amount > policy.total_limit) {
    return {
      access: 'denied',
      reason: `Would exceed cumulative spend limit ($${policy.total_spent + amount} / $${policy.total_limit})`,
      reveal_fields: [],
      hidden_fields: policy.hidden_fields,
      persona_fields: null,
      budget_impact: null,
      spend_impact: null,
    };
  }

  let budgetImpact: SimulationResult['budget_impact'] = null;
  try {
    const { data: budgetData } = await supabase.rpc('get_budget_usage', {
      p_vault_id: vaultId,
      p_category: policy.category,
    });
    const { data: budgetConfig } = await supabase
      .from('privacy_budgets')
      .select('*')
      .eq('vault_id', vaultId)
      .eq('category', policy.category)
      .maybeSingle();

    if (budgetConfig && budgetData) {
      budgetImpact = {
        disclosures_today: (budgetData.disclosures_today || 0) + 1,
        max_per_day: budgetConfig.max_disclosures_per_day,
        disclosures_this_week: (budgetData.disclosures_this_week || 0) + 1,
        max_per_week: budgetConfig.max_disclosures_per_week,
      };

      if (budgetImpact.disclosures_today > budgetImpact.max_per_day) {
        return {
          access: 'denied',
          reason: `Would exceed daily disclosure budget (${budgetImpact.disclosures_today} / ${budgetImpact.max_per_day})`,
          reveal_fields: [],
          hidden_fields: policy.hidden_fields,
          persona_fields: null,
          budget_impact: budgetImpact,
          spend_impact: null,
        };
      }

      if (budgetImpact.disclosures_this_week > budgetImpact.max_per_week) {
        return {
          access: 'denied',
          reason: `Would exceed weekly disclosure budget (${budgetImpact.disclosures_this_week} / ${budgetImpact.max_per_week})`,
          reveal_fields: [],
          hidden_fields: policy.hidden_fields,
          persona_fields: null,
          budget_impact: budgetImpact,
          spend_impact: null,
        };
      }
    }
  } catch {
    // Budget check optional
  }

  let personaFields: Record<string, string> | null = null;
  try {
    const { data: personas } = await supabase
      .from('ephemeral_personas')
      .select('*')
      .eq('vault_id', vaultId)
      .eq('policy_id', policy.id)
      .eq('active', true);

    const activePersona = (personas || []).find(
      (p: EphemeralPersona) => new Date(p.expires_at) > new Date()
    );
    if (activePersona) {
      personaFields = activePersona.mapped_fields;
    }
  } catch {
    // Persona check optional
  }

  return {
    access: 'granted',
    reveal_fields: policy.reveal_fields,
    hidden_fields: policy.hidden_fields,
    persona_fields: personaFields,
    budget_impact: budgetImpact,
    spend_impact: policy.total_limit > 0 ? {
      current_spent: policy.total_spent,
      request_amount: amount,
      total_limit: policy.total_limit,
    } : null,
  };
}

export function getSimulationCategories(): SecretCategory[] {
  return ['payment', 'identity', 'credentials', 'health', 'preferences'];
}
