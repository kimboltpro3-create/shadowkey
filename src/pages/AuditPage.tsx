import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollText, Eye, ShieldOff, Filter, DollarSign, Activity,
  Users, Server, ChevronUp, Download, RefreshCw, ExternalLink, CheckCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadDisclosureLogs, revokeAllAgentPolicies } from '../lib/shadowVault';
import { getBasescanUrl } from '../lib/contract';
import { useRealtime } from '../lib/realtime';
import { CategoryIcon } from '../components/vault/CategoryIcon';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CATEGORY_LABELS } from '../lib/constants';
import type { DisclosureLog, SecretCategory } from '../types';

function truncate(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

function formatDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function groupByDate(logs: DisclosureLog[]): [string, DisclosureLog[]][] {
  const map = new Map<string, DisclosureLog[]>();
  for (const log of logs) {
    const key = formatDate(log.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return Array.from(map.entries());
}

function LogEntry({
  log,
  onRevokeAll,
  revoking,
  isNew,
}: {
  log: DisclosureLog;
  onRevokeAll: (addr: string) => void;
  revoking: boolean;
  isNew: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white dark:bg-slate-900/60 border rounded-xl transition-all ${
      isNew
        ? 'border-cyan-500/40 animate-fade-in'
        : 'border-sky-200 dark:border-slate-800/60 hover:border-sky-300 dark:hover:border-slate-700/40'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <CategoryIcon category={log.category} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {log.agent_alias || truncate(log.agent_address)}
            </span>
            <span className="text-slate-500 dark:text-slate-600 text-xs">disclosed</span>
            <Badge variant="default">{CATEGORY_LABELS[log.category]}</Badge>
            <span className="text-slate-500 dark:text-slate-600 text-xs">to</span>
            <span className="text-slate-700 dark:text-slate-300 text-xs font-mono">{truncate(log.service_address)}</span>
            {log.amount && log.amount > 0 && (
              <Badge variant="warning">${log.amount.toFixed(2)}</Badge>
            )}
            {log.tx_hash && (
              <a
                href={getBasescanUrl(log.tx_hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs hover:bg-emerald-500/20 transition-all"
              >
                <CheckCircle size={9} /> Verified <ExternalLink size={8} />
              </a>
            )}
            {isNew && (
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                new
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-600">
            {timeAgo(log.timestamp)} · {new Date(log.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-600 hover:text-sky-600 dark:hover:text-cyan-400 hover:bg-sky-100 dark:hover:bg-cyan-500/10 transition-all"
          >
            {expanded ? <ChevronUp size={14} /> : <Eye size={14} />}
          </button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onRevokeAll(log.agent_address)}
            loading={revoking}
            title="Revoke all policies for this agent"
          >
            <ShieldOff size={12} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-slate-800/60 px-4 py-3 text-xs space-y-2 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-600 dark:text-slate-500 mb-1">Agent</p>
              <p className="text-slate-900 dark:text-white font-mono break-all">{log.agent_address}</p>
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-500 mb-1">Service</p>
              <p className="text-slate-900 dark:text-white font-mono break-all">{log.service_address}</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-sky-50 dark:bg-slate-800/60 border border-sky-200 dark:border-slate-700/40">
            <p className="text-slate-600 dark:text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Eye size={10} /> Encrypted disclosure details
            </p>
            <p className="text-slate-500 dark:text-slate-600 font-mono break-all leading-relaxed">
              {log.encrypted_details.slice(0, 96)}...
            </p>
            <p className="text-slate-400 dark:text-slate-700 mt-1.5">Only the vault owner can decrypt these details using their derived key.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORIES: SecretCategory[] = ['payment', 'identity', 'credentials', 'health', 'preferences'];
const POLL_INTERVAL = 15_000;

export function AuditPage() {
  const { vaultId, addToast } = useApp();
  const [logs, setLogs] = useState<DisclosureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SecretCategory | 'all'>('all');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());

  const fetchLogs = useCallback(async (showRefreshing = false) => {
    if (!vaultId) return;
    if (showRefreshing) setRefreshing(true);
    try {
      const data = await loadDisclosureLogs(vaultId);
      const incoming = new Set(data.map((l) => l.id));
      const added = data.filter((l) => !knownIdsRef.current.has(l.id));
      if (added.length > 0 && knownIdsRef.current.size > 0) {
        setNewIds(new Set(added.map((l) => l.id)));
        setTimeout(() => setNewIds(new Set()), 8000);
      }
      knownIdsRef.current = incoming;
      setLogs(data);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load audit log', 'error');
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useRealtime({ table: 'disclosure_logs', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: () => fetchLogs(), enabled: !!vaultId });

  useEffect(() => {
    const interval = setInterval(() => fetchLogs(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  async function handleRevokeAll(agentAddress: string) {
    if (!vaultId) return;
    setRevoking(agentAddress);
    try {
      await revokeAllAgentPolicies(vaultId, agentAddress);
      addToast('All policies for this agent revoked', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Revoke failed', 'error');
    } finally {
      setRevoking(null);
    }
  }

  function exportCSV() {
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = [
      ['Timestamp', 'Agent Alias', 'Agent Address', 'Category', 'Service', 'Amount'].map(escapeCSV).join(','),
      ...logs.map((l) =>
        [
          new Date(l.timestamp).toISOString(),
          l.agent_alias || '',
          l.agent_address,
          l.category,
          l.service_address,
          l.amount?.toFixed(2) || '',
        ].map(escapeCSV).join(',')
      ),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadowkey-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const weeklyLogs = logs.filter(
    (l) => new Date(l.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const uniqueAgents = new Set(logs.map((l) => l.agent_address)).size;
  const uniqueServices = new Set(logs.map((l) => l.service_address)).size;
  const totalSpend = logs.reduce((sum, l) => sum + (l.amount || 0), 0);

  const filtered = logs.filter((l) => {
    const matchAgent =
      !agentFilter ||
      l.agent_address.toLowerCase().includes(agentFilter.toLowerCase()) ||
      (l.agent_alias || '').toLowerCase().includes(agentFilter.toLowerCase());
    const matchCategory = categoryFilter === 'all' || l.category === categoryFilter;
    return matchAgent && matchCategory;
  });

  const grouped = groupByDate(filtered);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-sky-100 dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">Every agent disclosure, immutably recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(true)}
            className={`p-2 rounded-lg text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-800 transition-all ${refreshing ? 'animate-spin' : ''}`}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          {logs.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download size={12} /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Activity, label: 'This week', value: weeklyLogs.length, sub: 'disclosures' },
          { icon: Users, label: 'Agents', value: uniqueAgents, sub: 'unique' },
          { icon: Server, label: 'Services', value: uniqueServices, sub: 'reached' },
          { icon: DollarSign, label: 'Total spend', value: `$${totalSpend.toFixed(2)}`, sub: 'via agents' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} className="text-sky-600 dark:text-cyan-400" />
              <span className="text-xs text-slate-600 dark:text-slate-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-600" />
          <input
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="Filter by agent address or alias..."
            className="w-full bg-white dark:bg-slate-800/60 border border-sky-200 dark:border-slate-700/40 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-500/60 transition-all"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-all ${
              categoryFilter === 'all'
                ? 'bg-sky-500/15 dark:bg-cyan-500/15 border-sky-500/30 dark:border-cyan-500/30 text-sky-700 dark:text-cyan-300'
                : 'bg-white dark:bg-slate-800/60 border-sky-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            All
          </button>
          {CATEGORIES.filter((c) => logs.some((l) => l.category === c)).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-all ${
                categoryFilter === cat
                  ? 'bg-sky-500/15 dark:bg-cyan-500/15 border-sky-500/30 dark:border-cyan-500/30 text-sky-700 dark:text-cyan-300'
                  : 'bg-white dark:bg-slate-800/60 border-sky-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-800 flex items-center justify-center mb-4">
            <ScrollText size={24} className="text-sky-600 dark:text-slate-700" />
          </div>
          <p className="text-slate-700 dark:text-slate-400 font-medium mb-1">No disclosures logged</p>
          <p className="text-slate-500 dark:text-slate-600 text-sm">Run the Live Demo to generate your first disclosure event.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayLogs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{date}</span>
                <div className="flex-1 h-px bg-slate-800/60" />
                <span className="text-xs text-slate-600">{dayLogs.length} event{dayLogs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {dayLogs.map((log) => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    onRevokeAll={handleRevokeAll}
                    revoking={revoking === log.agent_address}
                    isNew={newIds.has(log.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-700">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-700 animate-pulse" />
        Auto-refreshes every {POLL_INTERVAL / 1000}s
      </div>
    </div>
  );
}
