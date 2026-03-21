import { useEffect, useState } from 'react';
import { ExternalLink, Shield, Zap, CheckCircle, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchRecentAttestations } from '../lib/eas';
import type { PublicAttestation } from '../lib/eas';
import { Button } from '../components/ui/Button';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../lib/constants';

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function AttestationsPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PublicAttestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchRecentAttestations(30)
      .then(setRecords)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-radial from-cyan-500/8 via-violet-500/4 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm">ShadowKey</span>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={load} loading={loading}>
              <RefreshCw size={12} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/agent-demo')}>
              <Zap size={12} />
              Try Demo
              <ArrowRight size={12} />
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · Base Mainnet · EAS Attestations
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            On-Chain Disclosure Proofs
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Every approved disclosure creates an EAS attestation on Base Mainnet —
            verifiable by anyone, forever. No PII is stored on-chain or here.
          </p>
        </div>

        {/* Stats strip */}
        {records.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Total Proofs', value: records.length, color: 'text-cyan-400' },
              { label: 'Fields Protected', value: records.reduce((s, r) => s + r.denied_count, 0), color: 'text-violet-400' },
              { label: 'Fields Shared', value: records.reduce((s, r) => s + r.approved_count, 0), color: 'text-teal-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm">Loading attestations from Base Mainnet...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
              <Shield size={20} className="text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium mb-2">No attestations yet</p>
            <p className="text-slate-600 text-sm mb-6">
              Run the Agent Demo with MetaMask connected to create the first on-chain proof.
            </p>
            <Button size="sm" onClick={() => navigate('/agent-demo')}>
              <Zap size={12} />
              Try Agent Demo
            </Button>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="space-y-3">
            {records.map((rec) => {
              const categoryKey = rec.category as keyof typeof CATEGORY_LABELS;
              const catLabel = CATEGORY_LABELS[categoryKey] ?? rec.category;
              const catColor = CATEGORY_COLORS[categoryKey] ?? 'bg-slate-700/40 text-slate-400';

              return (
                <div
                  key={rec.id}
                  className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle size={16} className="text-cyan-400" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white truncate">{rec.agent_name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catColor}`}>
                        {catLabel}
                      </span>
                    </div>
                    {rec.purpose && (
                      <p className="text-xs text-slate-500 truncate">{rec.purpose}</p>
                    )}
                  </div>

                  {/* Field counts */}
                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <div className="text-center">
                      <div className="text-teal-400 font-bold">{rec.approved_count}</div>
                      <div className="text-slate-600">shared</div>
                    </div>
                    <div className="text-center">
                      <div className="text-violet-400 font-bold">{rec.denied_count}</div>
                      <div className="text-slate-600">denied</div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-xs text-slate-600 shrink-0">
                    <Clock size={11} />
                    {timeAgo(rec.created_at)}
                  </div>

                  {/* Basescan link */}
                  {rec.basescan_url && (
                    <a
                      href={rec.basescan_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors shrink-0"
                    >
                      Basescan
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-slate-700 mt-10">
          Attestation records stored in Supabase for discoverability.
          On-chain source of truth at{' '}
          <a
            href="https://base.easscan.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-400 underline"
          >
            base.easscan.org
          </a>
        </p>
      </div>
    </div>
  );
}
