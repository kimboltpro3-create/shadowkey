import { useState, useEffect, useCallback } from 'react';
import { Plus, ShieldCheck, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadPolicies } from '../lib/shadowVault';
import { useRealtime } from '../lib/realtime';
import { PolicyCard } from '../components/policies/PolicyCard';
import { CreatePolicyModal } from '../components/policies/CreatePolicyModal';
import { Button } from '../components/ui/Button';
import type { Policy } from '../types';

export function PoliciesPage() {
  const { vaultId, addToast } = useApp();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      setPolicies(await loadPolicies(vaultId));
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load policies', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtime({ table: 'policies', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });

  const now = new Date();
  const active = policies.filter((p) => p.active && new Date(p.expires_at) > now);
  const expired = policies.filter((p) => p.active && new Date(p.expires_at) <= now);
  const revoked = policies.filter((p) => !p.active);
  const expiringIn7Days = active.filter((p) => new Date(p.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000);
  const filtered = filter === 'all' ? policies : filter === 'active' ? active : filter === 'expired' ? expired : revoked;

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-sky-100 dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Disclosure Policies</h1>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">Smart contract rules governing agent access</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm"><Plus size={14} /> New Policy</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle size={14} className="text-emerald-400" /><span className="text-xs text-slate-600 dark:text-slate-500">Active</span></div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{active.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={14} className="text-amber-400" /><span className="text-xs text-slate-600 dark:text-slate-500">Expiring soon</span></div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{expiringIn7Days.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} className="text-slate-500" /><span className="text-xs text-slate-600 dark:text-slate-500">Revoked</span></div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{revoked.length}</p>
        </div>
      </div>

      {expiringIn7Days.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            {expiringIn7Days.length} {expiringIn7Days.length === 1 ? 'policy expires' : 'policies expire'} within 7 days.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {(['all', 'active', 'expired', 'revoked'] as const).map((f) => {
          const count = f === 'all' ? policies.length : f === 'active' ? active.length : f === 'expired' ? expired.length : revoked.length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border ${
                filter === f ? 'bg-sky-500/15 dark:bg-cyan-500/15 border-sky-500/30 dark:border-cyan-500/30 text-sky-700 dark:text-cyan-300' : 'bg-white dark:bg-slate-800/60 border-sky-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              {f} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-800 flex items-center justify-center mb-4">
            <ShieldCheck size={24} className="text-sky-600 dark:text-slate-700" />
          </div>
          <p className="text-slate-700 dark:text-slate-400 font-medium mb-1">No policies yet</p>
          <p className="text-slate-500 dark:text-slate-600 text-sm mb-4">Create a policy to grant an agent scoped access to your vault</p>
          <Button onClick={() => setCreateOpen(true)} size="sm"><Plus size={14} /> Create First Policy</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => <PolicyCard key={p.id} policy={p} onRevoked={refresh} />)}
        </div>
      )}

      <CreatePolicyModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
    </div>
  );
}
