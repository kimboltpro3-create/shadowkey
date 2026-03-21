import { useState, useEffect, useCallback } from 'react';
import {
  Timer, ShieldOff, ShieldCheck, AlertTriangle, CheckCircle,
  RefreshCw, Settings, Clock, Zap, Activity,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  loadDeadManSwitch, upsertDeadManSwitch, checkInDeadManSwitch,
  triggerDeadManSwitch, loadPolicies, loadPersonas,
} from '../lib/shadowVault';
import { useRealtime } from '../lib/realtime';
import { Button } from '../components/ui/Button';
import type { DeadManSwitch, Policy, EphemeralPersona } from '../types';

const INTERVAL_PRESETS = [
  { label: '24 hours', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: '14 days', hours: 336 },
  { label: '30 days', hours: 720 },
];

function getTimeUntilDeadline(lastCheckIn: string, intervalHours: number): { hours: number; text: string; pct: number; urgent: boolean } {
  const deadline = new Date(lastCheckIn).getTime() + intervalHours * 60 * 60 * 1000;
  const remaining = deadline - Date.now();
  const totalMs = intervalHours * 60 * 60 * 1000;
  const pct = Math.max(0, Math.min(100, ((totalMs - remaining) / totalMs) * 100));

  if (remaining <= 0) return { hours: 0, text: 'OVERDUE', pct: 100, urgent: true };

  const h = Math.floor(remaining / (60 * 60 * 1000));
  const d = Math.floor(h / 24);
  if (d > 0) return { hours: h, text: `${d}d ${h % 24}h remaining`, pct, urgent: pct > 80 };
  return { hours: h, text: `${h}h remaining`, pct, urgent: pct > 80 };
}

function CountdownRing({ pct, size = 120 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (pct / 100) * circumference;
  const color = pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : '#22d3ee';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

export function DeadManSwitchPage() {
  const { vaultId, addToast } = useApp();
  const [dms, setDms] = useState<DeadManSwitch | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [personas, setPersonas] = useState<EphemeralPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [intervalHours, setIntervalHours] = useState(168);
  const [notifyBefore, setNotifyBefore] = useState(24);

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const [s, p, per] = await Promise.all([
        loadDeadManSwitch(vaultId),
        loadPolicies(vaultId),
        loadPersonas(vaultId),
      ]);
      setDms(s);
      setPolicies(p);
      setPersonas(per);
      if (s) {
        setIntervalHours(s.check_in_interval_hours);
        setNotifyBefore(s.notify_before_hours);
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtime({ table: 'dead_man_switches', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });
  useRealtime({ table: 'policies', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });

  const activePolicies = policies.filter((p) => p.active && new Date(p.expires_at) > new Date());
  const activePersonas = personas.filter((p) => p.active && new Date(p.expires_at) > new Date());
  const countdown = dms ? getTimeUntilDeadline(dms.last_check_in, dms.check_in_interval_hours) : null;

  async function handleEnable() {
    if (!vaultId) return;
    setSaving(true);
    try {
      await upsertDeadManSwitch(vaultId, {
        check_in_interval_hours: intervalHours,
        notify_before_hours: notifyBefore,
        active: true,
      });
      addToast('Dead man\'s switch enabled', 'success');
      await refresh();
      setConfigOpen(false);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to enable', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn() {
    if (!vaultId) return;
    setCheckingIn(true);
    try {
      await checkInDeadManSwitch(vaultId);
      addToast('Check-in recorded. Timer reset.', 'success');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Check-in failed', 'error');
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleTrigger() {
    if (!vaultId) return;
    if (!window.confirm('Are you sure you want to trigger the dead man\'s switch? This will immediately revoke all policies and personas.')) {
      return;
    }
    setTriggering(true);
    try {
      await triggerDeadManSwitch(vaultId);
      addToast('Dead man\'s switch triggered. All policies and personas revoked.', 'warning');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Trigger failed', 'error');
    } finally {
      setTriggering(false);
    }
  }

  async function handleDisable() {
    if (!vaultId) return;
    setSaving(true);
    try {
      await upsertDeadManSwitch(vaultId, { active: false });
      addToast('Dead man\'s switch disabled', 'info');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to disable', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveConfig() {
    if (!vaultId) return;
    setSaving(true);
    try {
      await upsertDeadManSwitch(vaultId, {
        check_in_interval_hours: intervalHours,
        notify_before_hours: notifyBefore,
      });
      addToast('Configuration saved', 'success');
      await refresh();
      setConfigOpen(false);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const isEnabled = dms?.active && !dms?.triggered;
  const isTriggered = dms?.triggered;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dead Man's Switch</h1>
          <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-0.5">Auto-revoke all agent access if you stop checking in</p>
        </div>
        {isEnabled && (
          <Button variant="outline" size="sm" onClick={() => setConfigOpen((v) => !v)}>
            <Settings size={12} /> Configure
          </Button>
        )}
      </div>

      <div className="mb-6 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
        <div className="flex items-start gap-2">
          <Timer size={14} className="text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-cyan-300 font-medium">How the Dead Man's Switch works</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-1 leading-relaxed">
              You set a check-in interval. If you fail to check in before the deadline, the switch triggers automatically:
              all active policies are revoked, all ephemeral personas are deactivated, and every agent immediately loses access.
              This guarantees human control even if you become incapacitated.
            </p>
          </div>
        </div>
      </div>

      {isTriggered && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <div className="flex items-center gap-3">
            <ShieldOff size={20} className="text-rose-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-300">Switch Triggered</p>
              <p className="text-xs text-rose-500/80 mt-0.5">
                All policies and personas have been revoked. Agents have zero access.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleCheckIn} loading={checkingIn}>
              <RefreshCw size={12} /> Reset & Re-enable
            </Button>
          </div>
        </div>
      )}

      {!dms || (!dms.active && !dms.triggered) ? (
        <div className="mb-6">
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-sky-300 dark:border-slate-700/40 flex items-center justify-center mb-4">
              <Timer size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium mb-1">Dead Man's Switch is disabled</p>
            <p className="text-slate-500 dark:text-slate-600 text-sm mb-6 max-w-md">
              Enable it to automatically revoke all agent access if you stop checking in.
            </p>

            <div className="mb-4 w-full max-w-sm">
              <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-2 block text-left">Check-in interval</label>
              <div className="flex flex-wrap gap-1.5">
                {INTERVAL_PRESETS.map(({ label, hours }) => (
                  <button key={hours} onClick={() => setIntervalHours(hours)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      intervalHours === hours ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                        : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            <Button onClick={handleEnable} loading={saving}>
              <Timer size={14} /> Enable Dead Man's Switch
            </Button>
          </div>
        </div>
      ) : isEnabled ? (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-6">
              <div className="relative flex items-center justify-center mb-3">
                <CountdownRing pct={countdown?.pct || 0} />
                <div className="absolute flex flex-col items-center">
                  {countdown?.urgent ? (
                    <AlertTriangle size={20} className="text-amber-400 mb-1" />
                  ) : (
                    <Clock size={20} className="text-cyan-600 dark:text-cyan-400 mb-1" />
                  )}
                  <span className={`text-sm font-bold ${countdown?.urgent ? 'text-amber-400' : 'text-white'}`}>
                    {countdown?.text}
                  </span>
                </div>
              </div>
              <Button onClick={handleCheckIn} loading={checkingIn} className="w-full">
                <CheckCircle size={14} /> Check In Now
              </Button>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={14} className="text-cyan-600 dark:text-cyan-400" />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">What happens when triggered</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <ShieldOff size={12} className="text-rose-400" />
                    </div>
                    <div>
                      <span className="text-slate-300">{activePolicies.length} active {activePolicies.length === 1 ? 'policy' : 'policies'} will be revoked</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <ShieldOff size={12} className="text-rose-400" />
                    </div>
                    <div>
                      <span className="text-slate-300">{activePersonas.length} ephemeral {activePersonas.length === 1 ? 'persona' : 'personas'} will be deactivated</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck size={12} className="text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-slate-300">Encrypted vault data remains intact and accessible only to you</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Interval</span>
                    <p className="text-slate-900 dark:text-white font-medium">{dms.check_in_interval_hours >= 24 ? `${Math.floor(dms.check_in_interval_hours / 24)} days` : `${dms.check_in_interval_hours} hours`}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Last check-in</span>
                    <p className="text-slate-900 dark:text-white font-medium">{new Date(dms.last_check_in).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Warning before</span>
                    <p className="text-slate-900 dark:text-white font-medium">{dms.notify_before_hours}h</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Auto-revoke</span>
                    <p className="text-emerald-400 font-medium">{dms.auto_revoke_all ? 'All policies' : 'Selected'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={handleTrigger} loading={triggering}>
                  <Zap size={12} /> Trigger Now (Test)
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisable} loading={saving}>
                  Disable Switch
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {configOpen && isEnabled && (
        <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 animate-fade-in">
          <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4">Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-2 block">Check-in interval</label>
              <div className="flex flex-wrap gap-1.5">
                {INTERVAL_PRESETS.map(({ label, hours }) => (
                  <button key={hours} onClick={() => setIntervalHours(hours)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      intervalHours === hours ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                        : 'bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-300'
                    }`}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 block">Warning notification (hours before deadline)</label>
              <input type="number" value={notifyBefore} onChange={(e) => setNotifyBefore(+e.target.value)}
                className="w-32 bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveConfig} loading={saving}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfigOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
