import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, AlertTriangle, TrendingUp, Settings,
  DollarSign, Server, Activity, ChevronDown, ChevronUp, Save,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadBudgets, upsertBudget, loadDisclosureLogs } from '../lib/shadowVault';
import { useRealtime } from '../lib/realtime';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/constants';
import { CategoryIcon } from '../components/vault/CategoryIcon';
import { Button } from '../components/ui/Button';
import type { PrivacyBudget, BudgetUsage, DisclosureLog, SecretCategory } from '../types';

const CATEGORIES: SecretCategory[] = ['payment', 'identity', 'credentials', 'health', 'preferences'];

function computeUsage(
  category: SecretCategory,
  logs: DisclosureLog[],
  budget: PrivacyBudget | null
): BudgetUsage {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const catLogs = logs.filter((l) => l.category === category);
  const todayLogs = catLogs.filter((l) => new Date(l.timestamp) >= startOfDay);
  const weekLogs = catLogs.filter((l) => new Date(l.timestamp) >= startOfWeek);

  return {
    category,
    disclosures_today: todayLogs.length,
    disclosures_this_week: weekLogs.length,
    unique_services: new Set(catLogs.map((l) => l.service_address)).size,
    spend_today: todayLogs.reduce((sum, l) => sum + (l.amount || 0), 0),
    budget,
  };
}

function BudgetRing({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const capped = Math.min(pct, 100);
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (capped / 100) * circumference;
  const fillColor = pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : color;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={fillColor} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

function UsageBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-600 dark:text-slate-400">{label}</span>
        <span className={`font-mono ${pct >= 90 ? 'text-rose-400' : pct >= 70 ? 'text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : color }}
        />
      </div>
    </div>
  );
}

function CategoryBudgetCard({
  usage,
  onSave,
  saving,
}: {
  usage: BudgetUsage;
  onSave: (category: SecretCategory, budget: Partial<PrivacyBudget>) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const colors = CATEGORY_COLORS[usage.category];
  const budget = usage.budget;

  const [maxDay, setMaxDay] = useState(budget?.max_disclosures_per_day ?? 10);
  const [maxWeek, setMaxWeek] = useState(budget?.max_disclosures_per_week ?? 50);
  const [maxServices, setMaxServices] = useState(budget?.max_unique_services ?? 5);
  const [maxSpend, setMaxSpend] = useState(budget?.max_spend_per_day ?? 0);
  const [alertPct, setAlertPct] = useState(budget?.alert_threshold_pct ?? 80);

  const dayPct = budget ? (budget.max_disclosures_per_day > 0 ? (usage.disclosures_today / budget.max_disclosures_per_day) * 100 : 0) : 0;
  const weekPct = budget ? (budget.max_disclosures_per_week > 0 ? (usage.disclosures_this_week / budget.max_disclosures_per_week) * 100 : 0) : 0;
  const overallPct = Math.max(dayPct, weekPct);
  const isAlert = budget && overallPct >= (budget.alert_threshold_pct || 80);

  function handleSave() {
    onSave(usage.category, {
      max_disclosures_per_day: maxDay,
      max_disclosures_per_week: maxWeek,
      max_unique_services: maxServices,
      max_spend_per_day: maxSpend,
      alert_threshold_pct: alertPct,
    });
    setEditing(false);
  }

  return (
    <div className={`rounded-xl border transition-all ${
      isAlert ? 'border-amber-500/40 bg-amber-500/5' : `border-sky-200 dark:border-sky-200 dark:border-slate-800/60 bg-white dark:bg-white dark:bg-slate-900/60 hover:border-sky-300 dark:hover:border-sky-300 dark:border-slate-700/40`
    }`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <CategoryIcon category={usage.category} size={14} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-900 dark:text-white">{CATEGORY_LABELS[usage.category]}</span>
            {isAlert && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                <AlertTriangle size={10} /> Alert
              </span>
            )}
            {!budget && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700/60 text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 text-xs">No budget set</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">
            <span>{usage.disclosures_today} today</span>
            <span>{usage.disclosures_this_week} this week</span>
            <span>{usage.unique_services} services</span>
            {usage.spend_today > 0 && <span>${usage.spend_today.toFixed(2)} spent today</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {budget && (
            <div className="relative flex items-center justify-center">
              <BudgetRing pct={overallPct} color={colors.icon.replace('text-', '').includes('emerald') ? '#34d399' : colors.icon.includes('blue') ? '#60a5fa' : colors.icon.includes('amber') ? '#fbbf24' : colors.icon.includes('rose') ? '#fb7185' : '#38bdf8'} />
              <span className="absolute text-xs font-bold text-slate-900 dark:text-slate-900 dark:text-white">{Math.round(overallPct)}%</span>
            </div>
          )}
          {expanded ? <ChevronUp size={14} className="text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600" /> : <ChevronDown size={14} className="text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-sky-200 dark:border-slate-800/60 px-4 py-4 animate-fade-in">
          {budget && !editing && (
            <div className="space-y-3 mb-4">
              <UsageBar value={usage.disclosures_today} max={budget.max_disclosures_per_day} label="Daily disclosures" color="#22d3ee" />
              <UsageBar value={usage.disclosures_this_week} max={budget.max_disclosures_per_week} label="Weekly disclosures" color="#22d3ee" />
              <UsageBar value={usage.unique_services} max={budget.max_unique_services} label="Unique services" color="#a78bfa" />
              {budget.max_spend_per_day > 0 && (
                <UsageBar value={usage.spend_today} max={budget.max_spend_per_day} label="Daily spend" color="#34d399" />
              )}
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 block">Max disclosures / day</label>
                  <input type="number" value={maxDay} onChange={(e) => setMaxDay(+e.target.value)}
                    className="w-full bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 block">Max disclosures / week</label>
                  <input type="number" value={maxWeek} onChange={(e) => setMaxWeek(+e.target.value)}
                    className="w-full bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 block">Max unique services</label>
                  <input type="number" value={maxServices} onChange={(e) => setMaxServices(+e.target.value)}
                    className="w-full bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 block">Max spend / day ($)</label>
                  <input type="number" value={maxSpend} onChange={(e) => setMaxSpend(+e.target.value)}
                    className="w-full bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1 block">Alert at {alertPct}% usage</label>
                <input type="range" min={50} max={100} value={alertPct} onChange={(e) => setAlertPct(+e.target.value)}
                  className="w-full accent-cyan-500" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} loading={saving}><Save size={12} /> Save Budget</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Settings size={12} /> {budget ? 'Edit Budget' : 'Set Budget'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function PrivacyBudgetPage() {
  const { vaultId, addToast } = useApp();
  const [budgets, setBudgets] = useState<PrivacyBudget[]>([]);
  const [logs, setLogs] = useState<DisclosureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategories, setSavingCategories] = useState<Set<SecretCategory>>(new Set());

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const [b, l] = await Promise.all([loadBudgets(vaultId), loadDisclosureLogs(vaultId)]);
      setBudgets(b);
      setLogs(l);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load budgets', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtime({ table: 'privacy_budgets', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });
  useRealtime({ table: 'disclosure_logs', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });

  const usages: BudgetUsage[] = CATEGORIES.map((cat) => {
    const budget = budgets.find((b) => b.category === cat) ?? null;
    return computeUsage(cat, logs, budget);
  });

  const totalToday = usages.reduce((s, u) => s + u.disclosures_today, 0);
  const totalWeek = usages.reduce((s, u) => s + u.disclosures_this_week, 0);
  const totalServices = new Set(logs.map((l) => l.service_address)).size;
  const totalSpend = usages.reduce((s, u) => s + u.spend_today, 0);
  const alertCount = usages.filter((u) => {
    if (!u.budget) return false;
    const dayPct = u.budget.max_disclosures_per_day > 0 ? (u.disclosures_today / u.budget.max_disclosures_per_day) * 100 : 0;
    const weekPct = u.budget.max_disclosures_per_week > 0 ? (u.disclosures_this_week / u.budget.max_disclosures_per_week) * 100 : 0;
    return Math.max(dayPct, weekPct) >= (u.budget.alert_threshold_pct || 80);
  }).length;

  async function handleSave(category: SecretCategory, budget: Partial<PrivacyBudget>) {
    if (!vaultId) return;
    setSavingCategories(prev => new Set(prev).add(category));
    try {
      await upsertBudget(vaultId, category, budget);
      addToast(`${CATEGORY_LABELS[category]} budget saved`, 'success');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to save budget', 'error');
    } finally {
      setSavingCategories(prev => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white dark:bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">Privacy Budget</h1>
        <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-0.5">Set disclosure limits per category to prevent privacy erosion over time</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { icon: Activity, label: 'Today', value: totalToday, sub: 'disclosures' },
          { icon: TrendingUp, label: 'This week', value: totalWeek, sub: 'disclosures' },
          { icon: Server, label: 'Services', value: totalServices, sub: 'reached' },
          { icon: DollarSign, label: 'Spend today', value: `$${totalSpend.toFixed(2)}`, sub: 'via agents' },
          { icon: AlertTriangle, label: 'Alerts', value: alertCount, sub: alertCount > 0 ? 'over threshold' : 'none' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white dark:bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-sky-200 dark:border-slate-800/60 rounded-xl p-3 hover:border-sky-300 dark:hover:border-sky-300 dark:border-slate-700/40 transition-all">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className="text-cyan-600 dark:text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600">{sub}</p>
          </div>
        ))}
      </div>

      {alertCount > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            {alertCount} {alertCount === 1 ? 'category has' : 'categories have'} reached the alert threshold. Review and tighten budgets to prevent privacy erosion.
          </p>
        </div>
      )}

      <div className="mb-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
        <div className="flex items-start gap-2">
          <PieChart size={14} className="text-cyan-600 dark:text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">How Privacy Budgets work</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-1 leading-relaxed">
              Each category gets a daily and weekly disclosure cap. When usage approaches the threshold you set, the system raises an alert.
              In production, the smart contract would automatically deny access requests that exceed the budget.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {usages.map((usage) => (
          <CategoryBudgetCard key={usage.category} usage={usage} onSave={handleSave} saving={savingCategories.has(usage.category)} />
        ))}
      </div>
    </div>
  );
}
