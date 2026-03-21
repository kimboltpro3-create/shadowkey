import { useState } from 'react';
import { ShieldOff, ChevronDown, ChevronUp, Clock, DollarSign, Eye, EyeOff, Server, Play, ExternalLink, CheckCircle } from 'lucide-react';
import type { Policy } from '../../types';
import { CATEGORY_LABELS } from '../../lib/constants';
import { revokePolicy } from '../../lib/shadowVault';
import { getBasescanUrl } from '../../lib/contract';
import { useApp } from '../../context/AppContext';
import { CategoryIcon } from '../vault/CategoryIcon';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SimulatePolicyModal } from './SimulatePolicyModal';

interface PolicyCardProps {
  policy: Policy;
  onRevoked: () => void;
}

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function getPolicyStatus(policy: Policy): { label: string; variant: 'success' | 'warning' | 'danger' | 'default' } {
  if (!policy.active) return { label: 'Revoked', variant: 'danger' };
  if (new Date(policy.expires_at) < new Date()) return { label: 'Expired', variant: 'default' };
  const pct = policy.total_limit > 0 ? (policy.total_spent / policy.total_limit) * 100 : 0;
  if (pct >= 90) return { label: 'Near limit', variant: 'warning' };
  return { label: 'Active', variant: 'success' };
}

export function PolicyCard({ policy, onRevoked }: PolicyCardProps) {
  const { addToast } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const status = getPolicyStatus(policy);
  const spendPct = policy.total_limit > 0 ? Math.min(100, (policy.total_spent / policy.total_limit) * 100) : 0;

  async function handleRevoke() {
    if (!window.confirm('Are you sure you want to revoke this policy? This action cannot be undone.')) {
      return;
    }
    setRevoking(true);
    try {
      await revokePolicy(policy.id);
      addToast(`Policy for ${truncate(policy.agent_address)} revoked`, 'success');
      onRevoked();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Revoke failed', 'error');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 hover:border-sky-300 dark:hover:border-slate-700/40 rounded-xl transition-all">
      <div className="flex items-center gap-3 px-4 py-3">
        <CategoryIcon category={policy.category} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-slate-900 dark:text-white font-mono">
              {policy.agent_alias || truncate(policy.agent_address)}
            </span>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="default">{CATEGORY_LABELS[policy.category]}</Badge>
            {policy.tx_hash && (
              <a
                href={getBasescanUrl(policy.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs hover:bg-emerald-500/20 transition-all"
              >
                <CheckCircle size={9} /> On-chain <ExternalLink size={8} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-600">
            <span className="flex items-center gap-1"><Clock size={10} /> Expires {new Date(policy.expires_at).toLocaleDateString()}</span>
            {policy.spend_limit > 0 && <span className="flex items-center gap-1"><DollarSign size={10} /> ${policy.spend_limit}/txn</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {policy.active && new Date(policy.expires_at) > new Date() && (
            <>
              <Button variant="outline" size="sm" onClick={() => setSimOpen(true)}>
                <Play size={12} /> Simulate
              </Button>
              <Button variant="danger" size="sm" onClick={handleRevoke} loading={revoking}>
                <ShieldOff size={12} /> Revoke
              </Button>
            </>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-700/40 transition-all"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-slate-800/60 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-600 dark:text-slate-500 mb-1 font-medium">Agent Address</p>
              <p className="text-slate-900 dark:text-white font-mono break-all text-xs">{policy.agent_address}</p>
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-500 mb-1 font-medium">Per-transaction limit</p>
              <p className="text-slate-900 dark:text-white">{policy.spend_limit > 0 ? `$${policy.spend_limit}` : 'None'}</p>
            </div>
          </div>

          {policy.total_limit > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-500">Cumulative spend</span>
                <span className="text-slate-900 dark:text-white">${policy.total_spent.toFixed(2)} / ${policy.total_limit}</span>
              </div>
              <div className="h-1.5 bg-sky-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${spendPct >= 90 ? 'bg-amber-500' : 'bg-sky-500 dark:bg-cyan-500'}`} style={{ width: `${spendPct}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-500 mb-1 font-medium"><Eye size={10} /> Reveal fields</div>
              <div className="flex flex-wrap gap-1">
                {policy.reveal_fields.map((f) => (
                  <span key={f} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">{f.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-500 mb-1 font-medium"><EyeOff size={10} /> Hidden fields</div>
              <div className="flex flex-wrap gap-1">
                {policy.hidden_fields.map((f) => (
                  <span key={f} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">{f.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          </div>

          {policy.allowed_services.length > 0 && (
            <div className="text-xs">
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-500 mb-1 font-medium"><Server size={10} /> Allowed services</div>
              <div className="flex flex-wrap gap-1">
                {policy.allowed_services.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-slate-800 border border-sky-200 dark:border-slate-700/40 text-slate-700 dark:text-slate-400 font-mono text-xs">
                    {s === 'any' ? 'Any service' : truncate(s)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <SimulatePolicyModal open={simOpen} onClose={() => setSimOpen(false)} policy={policy} />
    </div>
  );
}
