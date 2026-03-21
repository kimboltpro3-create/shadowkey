import { supabase } from './supabase';
import type { AgentReputation } from '../types';

export function getTrustLevel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 70) return { label: 'Trusted', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (score >= 40) return { label: 'Cautious', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  if (score >= 15) return { label: 'Untrusted', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  return { label: 'Blocked', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
}

export async function loadAgentReputations(vaultId: string): Promise<AgentReputation[]> {
  const { data, error } = await supabase
    .from('agent_reputation')
    .select('*')
    .eq('vault_id', vaultId)
    .order('trust_score', { ascending: true });
  if (error) throw new Error(`Failed to load reputations: ${error.message}`);
  return data || [];
}

export async function computeReputation(vaultId: string, agentAddress: string): Promise<AgentReputation | null> {
  const { error } = await supabase.rpc('compute_agent_reputation', {
    p_vault_id: vaultId,
    p_agent_address: agentAddress.toLowerCase(),
  });
  if (error) throw new Error(`Failed to compute reputation: ${error.message}`);

  const { data } = await supabase
    .from('agent_reputation')
    .select('*')
    .eq('vault_id', vaultId)
    .eq('agent_address', agentAddress.toLowerCase())
    .maybeSingle();
  return data;
}

export async function refreshAllReputations(vaultId: string): Promise<AgentReputation[]> {
  const { data: policies } = await supabase
    .from('policies')
    .select('agent_address')
    .eq('vault_id', vaultId);

  const uniqueAgents = [...new Set((policies || []).map((p: { agent_address: string }) => p.agent_address.toLowerCase()))];

  for (const agent of uniqueAgents) {
    await computeReputation(vaultId, agent);
  }

  return loadAgentReputations(vaultId);
}

export async function updateAutoRestrict(
  vaultId: string,
  agentAddress: string,
  enabled: boolean,
  threshold: number
): Promise<void> {
  const { error } = await supabase
    .from('agent_reputation')
    .update({ auto_restrict: enabled, restrict_threshold: threshold })
    .eq('vault_id', vaultId)
    .eq('agent_address', agentAddress.toLowerCase());
  if (error) throw new Error(`Failed to update auto-restrict: ${error.message}`);
}
