import { useState } from 'react';
import { Play, CheckCircle, XCircle, Eye, EyeOff, Ghost, BarChart3, DollarSign } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { simulateAccess } from '../../lib/simulation';
import { useApp } from '../../context/AppContext';
import { DEMO_SERVICE_ADDRESSES } from '../../lib/constants';
import type { Policy, SimulationResult } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  policy: Policy;
}

export function SimulatePolicyModal({ open, onClose, policy }: Props) {
  const { vaultId, addToast } = useApp();
  const [serviceAddress, setServiceAddress] = useState(DEMO_SERVICE_ADDRESSES.merchant);
  const [amount, setAmount] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  async function handleRun() {
    if (!vaultId) return;
    setRunning(true);
    setResult(null);
    try {
      const sim = await simulateAccess(vaultId, policy, serviceAddress, amount);
      setResult(sim);
    } catch (error) {
      console.error('Simulation failed:', error);
      addToast('Simulation failed. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Simulate Access Request" width="lg">
      <div className="space-y-4">
        <div className="bg-slate-800/40 rounded-lg px-3 py-2.5 text-xs">
          <span className="text-slate-500">Testing policy for </span>
          <span className="text-white font-mono">{policy.agent_alias || policy.agent_address.slice(0, 12)}...</span>
          <span className="text-slate-500"> on </span>
          <span className="text-cyan-400">{policy.category}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Service Address</label>
            <input
              type="text"
              value={serviceAddress}
              onChange={(e) => setServiceAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Request Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
              step={0.01}
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleRun} loading={running} className="w-full">
          <Play size={13} /> Run Simulation
        </Button>

        {result && (
          <div className="space-y-3 pt-2 border-t border-slate-800/60">
            <div className={`flex items-center justify-center gap-2 py-3 rounded-xl text-lg font-bold ${
              result.access === 'granted'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}>
              {result.access === 'granted' ? <CheckCircle size={20} /> : <XCircle size={20} />}
              ACCESS {result.access.toUpperCase()}
            </div>

            {result.reason && (
              <p className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">{result.reason}</p>
            )}

            {result.access === 'granted' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400 mb-1.5 font-medium">
                      <Eye size={11} /> Would reveal
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {result.reveal_fields.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                          {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-rose-400 mb-1.5 font-medium">
                      <EyeOff size={11} /> Would hide
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {result.hidden_fields.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                          {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {result.persona_fields && (
                  <div>
                    <div className="flex items-center gap-1 text-xs text-amber-400 mb-1.5 font-medium">
                      <Ghost size={11} /> Persona substitutions
                    </div>
                    <div className="space-y-1">
                      {Object.entries(result.persona_fields).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1">
                          <span className="text-slate-400">{key.replace(/_/g, ' ')}</span>
                          <span className="text-slate-600">-&gt;</span>
                          <span className="text-amber-400 font-mono">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.budget_impact && (
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-1 text-xs text-cyan-400 mb-2 font-medium">
                      <BarChart3 size={11} /> Budget impact
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Daily: </span>
                        <span className={result.budget_impact.disclosures_today > result.budget_impact.max_per_day ? 'text-rose-400' : 'text-white'}>
                          {result.budget_impact.disclosures_today} / {result.budget_impact.max_per_day}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Weekly: </span>
                        <span className={result.budget_impact.disclosures_this_week > result.budget_impact.max_per_week ? 'text-rose-400' : 'text-white'}>
                          {result.budget_impact.disclosures_this_week} / {result.budget_impact.max_per_week}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {result.spend_impact && (
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-1 text-xs text-emerald-400 mb-2 font-medium">
                      <DollarSign size={11} /> Spend impact
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500">Would add </span>
                      <span className="text-white">${result.spend_impact.request_amount}</span>
                      <span className="text-slate-500"> to total </span>
                      <span className="text-white">
                        (${(result.spend_impact.current_spent + result.spend_impact.request_amount).toFixed(2)} / ${result.spend_impact.total_limit})
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((result.spend_impact.current_spent + result.spend_impact.request_amount) / result.spend_impact.total_limit) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
