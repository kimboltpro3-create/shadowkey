import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Lock, TrendingUp, Shield, Eye, Zap, ArrowRight, CreditCard, User, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { loadSecrets, loadPolicies, loadDisclosureLogs } from '../lib/shadowVault';
import { useRealtime } from '../lib/realtime';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/constants';
import { SecretCard } from '../components/vault/SecretCard';
import { AddSecretModal } from '../components/vault/AddSecretModal';
import { Button } from '../components/ui/Button';
import type { VaultSecret, Policy, DisclosureLog, SecretCategory } from '../types';

const CATEGORIES: SecretCategory[] = ['payment', 'identity', 'credentials', 'health', 'preferences'];

const QUICK_ADD_HINTS = [
  { icon: CreditCard, label: 'Payment method', category: 'payment' as SecretCategory, example: 'Visa ending 4242' },
  { icon: User, label: 'Identity info', category: 'identity' as SecretCategory, example: 'Passport, email, DOB' },
  { icon: Key, label: 'API credentials', category: 'credentials' as SecretCategory, example: 'OpenAI, Anthropic keys' },
];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
      <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Icon size={14} className="text-sky-600 dark:text-cyan-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

function CategoryPill({
  category,
  count,
  active,
  onClick,
}: {
  category: SecretCategory | 'all';
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const colors = category !== 'all' ? CATEGORY_COLORS[category] : null;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
        active
          ? colors
            ? `${colors.bg} ${colors.border} ${colors.text}`
            : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
          : 'bg-white dark:bg-slate-800/60 border-sky-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:border-sky-300 dark:hover:border-slate-600'
      }`}
    >
      {category === 'all' ? 'All' : CATEGORY_LABELS[category]} ({count})
    </button>
  );
}

export function VaultPage() {
  const { vaultId, addToast } = useApp();
  const navigate = useNavigate();
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [logs, setLogs] = useState<DisclosureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SecretCategory | 'all'>('all');

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const [s, p, l] = await Promise.all([
        loadSecrets(vaultId),
        loadPolicies(vaultId),
        loadDisclosureLogs(vaultId),
      ]);
      setSecrets(s);
      setPolicies(p);
      setLogs(l);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load vault', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtime({ table: 'encrypted_secrets', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });
  useRealtime({ table: 'policies', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });

  const activePolicies = policies.filter((p) => p.active && new Date(p.expires_at) > new Date());
  const weeklyDisclosures = logs.filter(
    (l) => new Date(l.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const filtered =
    activeFilter === 'all' ? secrets : secrets.filter((s) => s.category === activeFilter);
  const byCategory = CATEGORIES.reduce<Record<SecretCategory, number>>((acc, cat) => {
    acc[cat] = secrets.filter((s) => s.category === cat).length;
    return acc;
  }, {} as Record<SecretCategory, number>);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-sky-100 dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-sky-100 dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = secrets.length === 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Vault</h1>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">Your encrypted secret storage</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus size={14} /> Add Secret
        </Button>
      </div>

      {isEmpty && (
        <div className="mb-6 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Get started with ShadowKey</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                Add your first secret, then run the Live Demo to see how agents get scoped access — without ever seeing your full identity.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus size={12} /> Add a Secret
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/demo')}>
                  <Zap size={12} /> Run Live Demo <ArrowRight size={11} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Quick add</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUICK_ADD_HINTS.map(({ icon: Icon, label, example }) => (
              <button
                key={label}
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 hover:border-sky-300 dark:hover:border-slate-700/40 hover:bg-sky-50 dark:hover:bg-slate-900/80 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-sky-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-300">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-600">{example}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Lock} label="Secrets stored" value={secrets.length} />
            <StatCard icon={Shield} label="Active policies" value={activePolicies.length} />
            <StatCard icon={Eye} label="This week" value={weeklyDisclosures.length} sub="disclosures" />
            <StatCard icon={TrendingUp} label="Total disclosures" value={logs.length} />
          </div>

          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            <CategoryPill
              category="all"
              count={secrets.length}
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
            />
            {CATEGORIES.filter((c) => byCategory[c] > 0).map((cat) => (
              <CategoryPill
                key={cat}
                category={cat}
                count={byCategory[cat]}
                active={activeFilter === cat}
                onClick={() => setActiveFilter(cat)}
              />
            ))}
          </div>
        </>
      )}

      {!isEmpty && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-slate-500 text-sm">No secrets in this category</p>
        </div>
      ) : !isEmpty ? (
        <div className="space-y-2">
          {filtered.map((secret) => (
            <SecretCard key={secret.id} secret={secret} onDeleted={refresh} />
          ))}
        </div>
      ) : null}

      <AddSecretModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
    </div>
  );
}
