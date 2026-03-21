import { supabase } from './supabase';
import { emergencyLockdownOnChain, liftLockdownOnChain, isContractAvailable } from './contract';
import type { LockdownEvent } from '../types';

export async function executeLockdown(
  vaultId: string,
  reason: string = 'manual'
): Promise<{ policies_revoked: number; personas_deactivated: number; budgets_frozen: number }> {
  const { data, error } = await supabase.rpc('emergency_lockdown', {
    p_vault_id: vaultId,
    p_reason: reason,
  });
  if (error) throw new Error(`Lockdown failed: ${error.message}`);

  // Dual-write: lockdown on-chain
  try {
    if (await isContractAvailable()) {
      await emergencyLockdownOnChain(reason);
    }
  } catch (e) {
    console.warn('On-chain lockdown failed (Supabase lockdown succeeded):', e);
  }

  return data;
}

export async function loadLockdownHistory(vaultId: string): Promise<LockdownEvent[]> {
  const { data, error } = await supabase
    .from('lockdown_events')
    .select('*')
    .eq('vault_id', vaultId)
    .order('triggered_at', { ascending: false });
  if (error) throw new Error(`Failed to load lockdown history: ${error.message}`);
  return data || [];
}

export async function markRestored(lockdownId: string): Promise<void> {
  const { error } = await supabase
    .from('lockdown_events')
    .update({ restored_at: new Date().toISOString() })
    .eq('id', lockdownId);
  if (error) throw new Error(`Failed to mark restored: ${error.message}`);

  // Dual-write: lift lockdown on-chain
  try {
    if (await isContractAvailable()) {
      await liftLockdownOnChain();
    }
  } catch (e) {
    console.warn('On-chain lift lockdown failed (Supabase update succeeded):', e);
  }
}

export async function getLatestLockdown(vaultId: string): Promise<LockdownEvent | null> {
  const { data, error } = await supabase
    .from('lockdown_events')
    .select('*')
    .eq('vault_id', vaultId)
    .is('restored_at', null)
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to check lockdown status: ${error.message}`);
  return data;
}
