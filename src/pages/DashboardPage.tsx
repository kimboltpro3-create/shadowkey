import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Shield, AlertTriangle, Award, Activity, Eye, Lock, Zap, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadPolicies, loadDisclosureLogs, loadBudgets, loadPersonas, loadDeadManSwitch } from '../lib/shadowVault';
import { computePrivacyGrade } from '../lib/privacyAdvisor';
import { generateRecommendations } from '../lib/privacyAdvisor';
import { Button } from '../components/ui/Button';
import type { Policy, DisclosureLog, PrivacyBudget, EphemeralPersona, DeadManSwitch } from '../types';

interface PrivacyMetrics {
  score: number;
  grade: string;
  trend: 'up' | 'down' | 'stable';
  totalPolicies: number;
  activePolicies: number;
  totalDisclosures: number;
  uniqueAgents: number;
  uniqueServices: number;
  activePersonas: number;
  deadManActive: boolean;
  highRiskCount: number;
}

export function DashboardPage() {
  const { vaultId, addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PrivacyMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<DisclosureLog[]>([]);

  useEffect(() => {
    if (!vaultId) return;
    loadData();
  }, [vaultId]);

  async function loadData() {
    if (!vaultId) return;

    try {
      setLoading(true);
      const [policies, logs, budgets, personas, deadman] = await Promise.all([
        loadPolicies(vaultId),
        loadDisclosureLogs(vaultId),
        loadBudgets(vaultId),
        loadPersonas(vaultId),
        loadDeadManSwitch(vaultId),
      ]);

      const recommendations = generateRecommendations(policies, logs, budgets, personas, deadman);
      const gradeInfo = computePrivacyGrade(recommendations);

      const uniqueAgents = new Set(logs.map((l) => l.agent_address)).size;
      const uniqueServices = new Set(logs.map((l) => l.service_address)).size;
      const activePolicies = policies.filter((p) => p.active).length;
      const activePersonas = personas.filter((p) => p.active && new Date(p.expires_at) > new Date()).length;
      const highRiskCount = recommendations.filter((r) => r.severity === 'high').length;

      const score = calculatePrivacyScore(policies, logs, budgets, personas, deadman);

      setMetrics({
        score,
        grade: gradeInfo.grade,
        trend: 'stable',
        totalPolicies: policies.length,
        activePolicies,
        totalDisclosures: logs.length,
        uniqueAgents,
        uniqueServices,
        activePersonas,
        deadManActive: deadman?.active || false,
        highRiskCount,
      });

      setRecentActivity(logs.slice(0, 5));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }

  function calculatePrivacyScore(
    policies: Policy[],
    _logs: DisclosureLog[],
    budgets: PrivacyBudget[],
    personas: EphemeralPersona[],
    deadman: DeadManSwitch | null
  ): number {
    let score = 50;

    if (budgets.length > 0) score += 10;
    if (personas.filter((p) => p.active).length > 0) score += 10;
    if (deadman?.active) score += 10;

    const activePolicies = policies.filter((p) => p.active);
    if (activePolicies.length > 0) {
      const withHiddenFields = activePolicies.filter((p) => p.hidden_fields.length > 0).length;
      score += Math.min(10, (withHiddenFields / activePolicies.length) * 10);
    }

    const policiesWithLimits = activePolicies.filter((p) => p.spend_limit || p.total_limit).length;
    if (activePolicies.length > 0) {
      score += Math.min(10, (policiesWithLimits / activePolicies.length) * 10);
    }

    return Math.min(100, Math.round(score));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Failed to load dashboard metrics</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Privacy Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">Your data protection at a glance</p>
        </div>
        <Button size="sm" onClick={loadData}>
          <Activity size={14} />
          Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 p-6 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 dark:from-cyan-500/10 dark:to-teal-500/10 border border-sky-300 dark:border-cyan-500/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-sky-700 dark:text-cyan-400 mb-1">Privacy Score</p>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold text-slate-900 dark:text-white">{metrics.score}</span>
                <span className="text-2xl font-semibold text-slate-600 dark:text-slate-400 mb-1">/100</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-sky-400 dark:from-cyan-500 dark:to-teal-500 flex items-center justify-center">
              <Shield size={32} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              metrics.grade === 'A' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              metrics.grade === 'B' ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400' :
              metrics.grade === 'C' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              'bg-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}>
              Grade {metrics.grade}
            </span>
            {metrics.trend === 'up' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <TrendingUp size={12} /> Improving
              </span>
            )}
            {metrics.trend === 'down' && (
              <span className="flex items-center gap-1 text-xs text-rose-400">
                <TrendingDown size={12} /> Declining
              </span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={16} className="text-sky-600 dark:text-teal-400" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Active Policies</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{metrics.activePolicies}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">of {metrics.totalPolicies} total</p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={16} className="text-sky-600 dark:text-cyan-400" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Disclosures</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{metrics.totalDisclosures}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">{metrics.uniqueAgents} agents, {metrics.uniqueServices} services</p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-xl border ${
          metrics.activePersonas > 0
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-white dark:bg-slate-900/60 border-sky-200 dark:border-slate-800/60'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Personas Active</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.activePersonas}</p>
            </div>
            {metrics.activePersonas > 0 && <Zap size={20} className="text-emerald-400" />}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          metrics.deadManActive
            ? 'bg-teal-500/5 border-teal-500/20'
            : 'bg-white dark:bg-slate-900/60 border-sky-200 dark:border-slate-800/60'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Dead Man Switch</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.deadManActive ? 'ON' : 'OFF'}</p>
            </div>
            {metrics.deadManActive && <Shield size={20} className="text-teal-400" />}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${
          metrics.highRiskCount > 0
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-white dark:bg-slate-900/60 border-sky-200 dark:border-slate-800/60'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">High Risk Issues</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.highRiskCount}</p>
            </div>
            {metrics.highRiskCount > 0 && <AlertTriangle size={20} className="text-amber-400" />}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 dark:from-cyan-500/10 dark:to-teal-500/10 border border-sky-300 dark:border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-700 dark:text-cyan-400 mb-1">Privacy Rank</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">Top 25%</p>
            </div>
            <Award size={20} className="text-sky-600 dark:text-cyan-400" />
          </div>
        </div>
      </div>

      {metrics.highRiskCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300 mb-1">Action Recommended</p>
              <p className="text-xs text-amber-500/80 mb-3">
                You have {metrics.highRiskCount} high-priority privacy recommendation{metrics.highRiskCount > 1 ? 's' : ''}.
                Review them in the Forensics page to improve your privacy score.
              </p>
              <Button size="sm" variant="outline" onClick={() => window.location.href = '/forensics'}>
                View Recommendations
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          <a href="/audit" className="text-xs text-sky-600 dark:text-cyan-400 hover:text-sky-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1">
            View All <ArrowRight size={12} />
          </a>
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-8">No disclosure activity yet</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-sky-50 dark:bg-slate-950/60 border border-sky-200 dark:border-slate-800">
                <Activity size={16} className="text-sky-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{log.agent_alias || 'Unknown Agent'}</p>
                    <span className="px-2 py-0.5 rounded text-xs bg-sky-200 dark:bg-slate-800 text-sky-700 dark:text-slate-400">{log.category}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-500">
                    Disclosure logged
                    {log.amount && ` • $${log.amount.toFixed(2)}`}
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-600 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
