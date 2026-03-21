import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight, Plus, CheckCircle, XCircle, Clock, Shield,
  AlertTriangle, ChevronDown, ChevronUp, MessageSquare, Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  loadReverseRequests, createReverseRequest, respondToReverseRequest,
} from '../lib/shadowVault';
import { useRealtime } from '../lib/realtime';
import { CATEGORY_LABELS, CATEGORY_FIELDS, EXPIRY_PRESETS } from '../lib/constants';
import { CategoryIcon } from '../components/vault/CategoryIcon';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { ReverseDisclosureRequest, SecretCategory } from '../types';

function truncate(addr: string) {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function statusBadge(status: ReverseDisclosureRequest['status']) {
  switch (status) {
    case 'pending': return <Badge variant="warning">Pending</Badge>;
    case 'approved': return <Badge variant="success">Approved</Badge>;
    case 'denied': return <Badge variant="danger">Denied</Badge>;
    case 'expired': return <Badge variant="default">Expired</Badge>;
  }
}

function RequestCard({
  request, onApprove, onDeny, responding,
}: {
  request: ReverseDisclosureRequest;
  onApprove: (id: string, fields: string[]) => void;
  onDeny: (id: string) => void;
  responding: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const isPending = request.status === 'pending';
  const isExpired = new Date(request.expires_at) <= new Date();

  function toggleField(field: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  return (
    <div className={`rounded-xl border transition-all ${
      isPending && !isExpired
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-sky-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 hover:border-sky-300 dark:border-slate-700/40'
    }`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <CategoryIcon category={request.category} size={14} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {request.service_name || truncate(request.service_address)}
            </span>
            {statusBadge(isExpired && isPending ? 'expired' : request.status)}
            {isPending && !isExpired && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs animate-pulse">
                Awaiting your decision
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-0.5">
            Requesting {request.requested_fields.length} fields from {CATEGORY_LABELS[request.category]}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">
              <Clock size={10} />
              {isExpired ? 'Expired' : `Expires ${new Date(request.expires_at).toLocaleDateString()}`}
            </div>
          </div>
          {expanded ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-slate-800/60 px-4 py-4 animate-fade-in">
          {request.justification && (
            <div className="mb-4 p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40 border border-slate-700/30">
              <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 flex items-center gap-1">
                <MessageSquare size={10} /> Justification from service
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">{request.justification}</p>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-2">Requested fields:</p>
            <div className="flex flex-wrap gap-1.5">
              {request.requested_fields.map((field) => (
                <span key={field} className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  {field.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          {request.status === 'approved' && request.response_fields.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-emerald-400 mb-2">Fields you approved:</p>
              <div className="flex flex-wrap gap-1.5">
                {request.response_fields.map((field) => (
                  <span key={field} className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    {field.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isPending && !isExpired && (
            <div className="mt-4 p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40 border border-slate-700/30">
              <p className="text-xs text-slate-400 mb-3">Select which fields to approve (you can approve a subset):</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {request.requested_fields.map((field) => (
                  <button
                    key={field}
                    onClick={(e) => { e.stopPropagation(); toggleField(field); }}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                      selectedFields.has(field)
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {selectedFields.has(field) ? <CheckCircle size={10} className="inline mr-1" /> : null}
                    {field.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onApprove(request.id, Array.from(selectedFields)); }}
                  loading={responding}
                  disabled={selectedFields.size === 0}
                >
                  <CheckCircle size={12} /> Approve {selectedFields.size > 0 ? `(${selectedFields.size} fields)` : ''}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDeny(request.id); }}
                  loading={responding}
                >
                  <XCircle size={12} /> Deny All
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-600 dark:text-slate-500">Service address</span>
              <p className="text-slate-900 dark:text-white font-mono break-all">{request.service_address}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-600 dark:text-slate-500">Created</span>
              <p className="text-slate-900 dark:text-white">{new Date(request.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimulateRequestModal({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { vaultId, addToast } = useApp();
  const [serviceName, setServiceName] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [category, setCategory] = useState<SecretCategory>('identity');
  const [justification, setJustification] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [expiryDays, setExpiryDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const availableFields = CATEGORY_FIELDS[category] || [];

  function toggleField(field: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  async function handleCreate() {
    if (!vaultId || !serviceAddress || selectedFields.size === 0) return;
    setCreating(true);
    try {
      await createReverseRequest(vaultId, {
        service_address: serviceAddress,
        service_name: serviceName,
        requested_fields: Array.from(selectedFields),
        justification,
        category,
        expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
      });
      addToast('Simulated request created', 'success');
      onCreated();
      onClose();
      setServiceName('');
      setServiceAddress('');
      setJustification('');
      setSelectedFields(new Set());
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create request', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Simulate Service Request" width="lg">
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-xs text-amber-300 flex items-center gap-1.5">
            <AlertTriangle size={11} /> This simulates a service requesting your data. In production, services would submit these requests through the smart contract.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Service name</label>
            <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Acme Airlines"
              className="w-full bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Service address</label>
            <input value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} placeholder="0x..."
              className="w-full bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500/60" />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {(['identity', 'payment', 'credentials', 'health', 'preferences'] as SecretCategory[]).map((cat) => (
              <button key={cat} onClick={() => { setCategory(cat); setSelectedFields(new Set()); }}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-all ${
                  category === cat ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                    : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
                }`}>{cat}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Requested fields</label>
          <div className="flex flex-wrap gap-1.5">
            {availableFields.map((field) => (
              <button key={field} onClick={() => toggleField(field)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                  selectedFields.has(field)
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                    : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
                }`}>{field.replace(/_/g, ' ')}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Justification</label>
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)}
            placeholder="We need your identity information to process your booking..."
            rows={3}
            className="w-full bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60 resize-none" />
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Request expires</label>
          <div className="flex gap-1.5">
            {EXPIRY_PRESETS.map(({ label, days }) => (
              <button key={days} onClick={() => setExpiryDays(days)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  expiryDays === days ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                    : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} loading={creating} disabled={!serviceAddress || selectedFields.size === 0}>
            <Send size={12} /> Submit Request
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ReverseDisclosurePage() {
  const { vaultId, addToast } = useApp();
  const [requests, setRequests] = useState<ReverseDisclosureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      setRequests(await loadReverseRequests(vaultId));
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtime({ table: 'reverse_disclosure_requests', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });

  async function handleApprove(id: string, fields: string[]) {
    setRespondingIds(prev => new Set(prev).add(id));
    try {
      await respondToReverseRequest(id, 'approved', fields);
      addToast('Request approved with selected fields', 'success');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to approve', 'error');
    } finally {
      setRespondingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDeny(id: string) {
    setRespondingIds(prev => new Set(prev).add(id));
    try {
      await respondToReverseRequest(id, 'denied');
      addToast('Request denied', 'info');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to deny', 'error');
    } finally {
      setRespondingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const pending = requests.filter((r) => r.status === 'pending' && new Date(r.expires_at) > new Date());
  const approved = requests.filter((r) => r.status === 'approved');
  const denied = requests.filter((r) => r.status === 'denied');

  const filtered = filter === 'all' ? requests
    : filter === 'pending' ? pending
    : filter === 'approved' ? approved
    : denied;

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reverse Disclosure</h1>
          <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-0.5">Services must request your data — you decide what to share</p>
        </div>
        <Button onClick={() => setSimulateOpen(true)} size="sm">
          <Plus size={14} /> Simulate Request
        </Button>
      </div>

      <div className="mb-6 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
        <div className="flex items-start gap-2">
          <ArrowLeftRight size={14} className="text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-cyan-300 font-medium">Flipping the trust model</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-1 leading-relaxed">
              Instead of agents pushing your data to services, services must submit a formal request explaining
              what data they need and why. You review each request and approve only the specific fields you're
              comfortable sharing — or deny it entirely. The service earns the right to receive your data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={13} className="text-amber-400" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Pending</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{pending.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={13} className="text-emerald-400" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Approved</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{approved.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={13} className="text-rose-400" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Denied</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{denied.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={13} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{requests.length}</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            {pending.length} {pending.length === 1 ? 'request is' : 'requests are'} awaiting your decision.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {(['all', 'pending', 'approved', 'denied'] as const).map((f) => {
          const count = f === 'all' ? requests.length : f === 'pending' ? pending.length : f === 'approved' ? approved.length : denied.length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border ${
                filter === f ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
              }`}>{f} ({count})</button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
            <ArrowLeftRight size={24} className="text-slate-700" />
          </div>
          <p className="text-slate-400 font-medium mb-1">No requests yet</p>
          <p className="text-slate-500 dark:text-slate-600 text-sm mb-4">Simulate a service request to see how reverse disclosure works</p>
          <Button onClick={() => setSimulateOpen(true)} size="sm"><Plus size={14} /> Simulate Request</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <RequestCard key={req.id} request={req} onApprove={handleApprove} onDeny={handleDeny} responding={respondingIds.has(req.id)} />
          ))}
        </div>
      )}

      <SimulateRequestModal open={simulateOpen} onClose={() => setSimulateOpen(false)} onCreated={refresh} />
    </div>
  );
}
