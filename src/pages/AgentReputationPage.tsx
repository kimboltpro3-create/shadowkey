import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, UserCheck, ShieldAlert, ArrowUpDown, Clock, DollarSign, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadAgentReputations, refreshAllReputations, getTrustLevel, updateAutoRestrict } from '../lib/agentReputation';
import { Button } from '../components/ui/Button';
import type { AgentReputation } from '../types';
import { useNavigate } from 'react-router-dom';

function truncate(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

type SortKey = 'trust_score' | 'total_requests' | 'last_active';

function TrustRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;
  const level = getTrustLevel(score);

  const strokeColor = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : score >= 15 ? '#fb7185' : '#ef4444';

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-800" />
        <circle
          cx="32" cy="32" r="28" fill="none"
          stroke={strokeColor} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${level.color}`}>{score}</span>
      </div>
    </div>
  );
}

function AgentCard({ agent, onRefresh }: { agent: AgentReputation; onRefresh: () => void }) {
  const { addToast } = useApp();
  const navigate = useNavigate();
  const level = getTrustLevel(agent.trust_score);
  const [toggling, setToggling] = useState(false);

  async function handleToggleRestrict() {
    setToggling(true);
    try {
      await updateAutoRestrict(
        agent.vault_id,
        agent.agent_address,
        !agent.auto_restrict,
        agent.restrict_threshold
      );
      addToast(`Auto-restrict ${!agent.auto_restrict ? 'enabled' : 'disabled'}`, 'success');
      onRefresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 hover:border-sky-300 dark:border-slate-700/40 rounded-xl transition-all p-4">
      <div className="flex items-start gap-4">
        <TrustRing score={agent.trust_score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-slate-900 dark:text-white font-mono">
              {agent.agent_alias || truncate(agent.agent_address)}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${level.bg} ${level.color} border ${level.border}`}>
              {level.label}
            </span>
          </div>
          {agent.agent_alias && (
            <p className="text-xs text-slate-500 dark:text-slate-600 font-mono mb-2">{truncate(agent.agent_address)}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-600 dark:text-slate-500">
              <CheckCircle size={11} className="text-emerald-400" />
              <span>{agent.approved_requests} approved</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-600 dark:text-slate-500">
              <XCircle size={11} className="text-rose-400" />
              <span>{agent.denied_requests} denied</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-600 dark:text-slate-500">
              <DollarSign size={11} className="text-emerald-400" />
              <span>${Number(agent.spend_total).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-600 dark:text-slate-500">
              <Clock size={11} />
              <span>{agent.last_active ? new Date(agent.last_active).toLocaleDateString() : 'Never'}</span>
            </div>
          </div>

          {agent.budget_violations > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1 mb-3">
              <AlertTriangle size={11} />
              <span>{agent.budget_violations} budget violation{agent.budget_violations > 1 ? 's' : ''}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleRestrict}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all border ${
                agent.auto_restrict
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
              }`}
            >
              <ShieldAlert size={11} />
              Auto-restrict {agent.auto_restrict ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => navigate('/policies')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300 transition-all"
            >
              <ExternalLink size={10} /> View Policies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentReputationPage() {
  const { vaultId, addToast } = useApp();
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('trust_score');

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const data = await loadAgentReputations(vaultId);
      setAgents(data);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load reputations', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleRefreshAll() {
    if (!vaultId) return;
    setRefreshing(true);
    try {
      const data = await refreshAllReputations(vaultId);
      setAgents(data);
      addToast(`Refreshed ${data.length} agent scores`, 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Refresh failed', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  const sorted = [...agents].sort((a, b) => {
    if (sortBy === 'trust_score') return b.trust_score - a.trust_score;
    if (sortBy === 'total_requests') return b.total_requests - a.total_requests;
    if (sortBy === 'last_active') return (b.last_active || '').localeCompare(a.last_active || '');
    return 0;
  });

  const trusted = agents.filter((a) => a.trust_score >= 70).length;
  const cautious = agents.filter((a) => a.trust_score >= 40 && a.trust_score < 70).length;
  const untrusted = agents.filter((a) => a.trust_score < 40).length;

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Agent Trust Scores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500">Behavioral analysis of every agent interacting with your vault</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefreshAll} loading={refreshing}>
          <RefreshCw size={13} /> Refresh Scores
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-slate-900 dark:text-white">{agents.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Total Agents</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-emerald-400">{trusted}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Trusted</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-amber-400">{cautious}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Cautious</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-rose-400">{untrusted}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">At Risk</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <ArrowUpDown size={12} className="text-slate-500" />
        <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Sort by:</span>
        {(['trust_score', 'total_requests', 'last_active'] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2 py-1 rounded text-xs transition-all ${
              sortBy === key
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                : 'text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
            }`}
          >
            {key === 'trust_score' ? 'Score' : key === 'total_requests' ? 'Activity' : 'Last Seen'}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <UserCheck size={40} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1">No agent data yet</p>
          <p className="text-xs text-slate-500 dark:text-slate-600">Click "Refresh Scores" after creating policies and running the demo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
