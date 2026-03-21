import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Lock, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';

// ─── Mobile Approval Page ─────────────────────────────────────────────────────
//
// Opened by scanning the QR code shown in the agent demo waiting state.
// Loads the pending disclosure from Supabase by request ID and lets the
// vault owner approve or deny field-by-field — NO wallet or MetaMask required.
//
// URL format: /approve?id=<requestId>&agent=<agentName>
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_FIELDS = ['cvv', 'card_number', 'passport_number', 'ssn', 'health_data'];

interface DisclosureRecord {
  id: string;
  service_name: string;
  fields_requested: string[];
  purpose: string;
  category: string;
  status: string;
  expires_at: string;
}

export function ApprovePage() {
  const [params] = useSearchParams();
  const requestId = params.get('id') || params.get('approve');
  const agentParam = params.get('agent');

  const [record, setRecord] = useState<DisclosureRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<'approved' | 'denied' | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError('No request ID in URL.');
      setLoading(false);
      return;
    }

    supabase
      .from('disclosure_logs')
      .select('id, service_name, fields_requested, purpose, category, status, expires_at')
      .eq('id', requestId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Request not found or already resolved.');
        } else if (data.status !== 'pending') {
          setError(`This request was already ${data.status}.`);
        } else if (new Date(data.expires_at) < new Date()) {
          setError('This request has expired.');
        } else {
          setRecord(data);
          // Pre-select all non-sensitive fields
          setSelected(new Set(
            (data.fields_requested as string[]).filter(f => !SENSITIVE_FIELDS.includes(f))
          ));
        }
        setLoading(false);
      });
  }, [requestId]);

  const toggle = (field: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleApprove = async () => {
    if (!record || selected.size === 0) return;
    setSubmitting(true);
    const { error: err } = await supabase
      .from('disclosure_logs')
      .update({
        status: 'approved',
        fields_disclosed: Array.from(selected),
        approved_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (err) {
      setError('Failed to submit approval. Please try again.');
    } else {
      setDone('approved');
    }
    setSubmitting(false);
  };

  const handleDeny = async () => {
    if (!record) return;
    setSubmitting(true);
    const { error: err } = await supabase
      .from('disclosure_logs')
      .update({ status: 'denied' })
      .eq('id', record.id);

    if (err) {
      setError('Failed to submit denial. Please try again.');
    } else {
      setDone('denied');
    }
    setSubmitting(false);
  };

  // ── Done state ─────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          {done === 'approved' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Access Granted</h1>
              <p className="text-sm text-slate-400">
                <strong className="text-white">{record?.service_name || agentParam}</strong> has been granted access to {selected.size} field{selected.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-xs text-slate-600 mt-4">You can close this tab.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-rose-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
              <p className="text-sm text-slate-400">
                All fields were protected. The agent has been notified.
              </p>
              <p className="text-xs text-slate-600 mt-4">You can close this tab.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Loading / error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-rose-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Request Unavailable</h1>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // ── Approval UI ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mx-auto mb-3">
            <Lock size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">ShadowKey</h1>
          <p className="text-xs text-slate-500 mt-1">Privacy vault access request</p>
        </div>

        {/* Request card */}
        <div className="p-4 rounded-xl bg-amber-500/5 border-2 border-amber-500/30 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">Access Request</span>
          </div>

          <div className="mb-3 p-3 rounded-lg bg-slate-900/60">
            <p className="text-sm text-slate-300">
              <strong className="text-white">{record!.service_name || agentParam}</strong>
              {' '}is requesting access to your{' '}
              <strong className="text-cyan-400">{record!.category}</strong> data
            </p>
            <p className="text-xs text-slate-500 mt-1">Purpose: {record!.purpose}</p>
            <p className="text-[10px] text-slate-600 font-mono mt-1">ID: {record!.id.slice(0, 8)}...</p>
          </div>

          {/* Field selection */}
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
            Select fields to share:
          </p>
          <div className="space-y-2 mb-4">
            {record!.fields_requested.map((field) => {
              const isSensitive = SENSITIVE_FIELDS.includes(field);
              const isChecked = selected.has(field);
              return (
                <label
                  key={field}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-slate-800/40 border border-slate-700/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(field)}
                    className="rounded border-slate-600 bg-slate-800 text-emerald-500"
                  />
                  <span className={`text-sm font-mono flex-1 ${isChecked ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {field}
                  </span>
                  {isSensitive && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                      SENSITIVE
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={selected.size === 0 || submitting}
              className="flex-1"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Approve ({selected.size})
            </Button>
            <Button size="sm" variant="danger" onClick={handleDeny} disabled={submitting} className="flex-1">
              <XCircle size={14} />
              Deny All
            </Button>
          </div>
        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-900/40 border border-slate-800/40">
          <ShieldCheck size={14} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-slate-500">
            Your data is encrypted with AES-GCM in your browser. Supabase stores ciphertext only — plaintext and keys never leave your device, and approved values are never sent to any AI model.
          </p>
        </div>
      </div>
    </div>
  );
}
