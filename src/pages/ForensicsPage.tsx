import { useState, useEffect, useCallback } from 'react';
import {
  Search, Eye, EyeOff, Shield, AlertTriangle, Server,
  Activity, ChevronDown, ChevronUp, Fingerprint, TrendingUp,
  Lightbulb, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { loadDisclosureLogs, loadPolicies, loadBudgets, loadPersonas, loadDeadManSwitch } from '../lib/shadowVault';
import { generateRecommendations, computePrivacyGrade } from '../lib/privacyAdvisor';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/constants';
import { CategoryIcon } from '../components/vault/CategoryIcon';
import { Badge } from '../components/ui/Badge';
import type {
  DisclosureLog, Policy, AdversaryProfile, SecretCategory,
  PrivacyBudget, EphemeralPersona, DeadManSwitch, PrivacyRecommendation,
} from '../types';

function truncate(addr: string) {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function buildAdversaryProfiles(logs: DisclosureLog[], policies: Policy[]): AdversaryProfile[] {
  const serviceMap = new Map<string, {
    knownFields: Set<string>;
    totalInteractions: number;
    totalSpend: number;
    categories: Set<SecretCategory>;
    firstSeen: string;
    lastSeen: string;
  }>();

  for (const log of logs) {
    const key = log.service_address;
    if (!serviceMap.has(key)) {
      serviceMap.set(key, {
        knownFields: new Set(),
        totalInteractions: 0,
        totalSpend: 0,
        categories: new Set(),
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
      });
    }
    const profile = serviceMap.get(key)!;
    profile.totalInteractions++;
    profile.totalSpend += log.amount || 0;
    profile.categories.add(log.category);
    if (new Date(log.timestamp) < new Date(profile.firstSeen)) profile.firstSeen = log.timestamp;
    if (new Date(log.timestamp) > new Date(profile.lastSeen)) profile.lastSeen = log.timestamp;

    const matchingPolicies = policies.filter((p) =>
      p.allowed_services.includes(key) || p.allowed_services.includes('any')
    );
    for (const pol of matchingPolicies) {
      for (const field of pol.reveal_fields) {
        profile.knownFields.add(field);
      }
    }
  }

  return Array.from(serviceMap.entries()).map(([service, data]) => ({
    service,
    knownFields: Array.from(data.knownFields),
    totalInteractions: data.totalInteractions,
    totalSpend: data.totalSpend,
    categories: Array.from(data.categories),
    firstSeen: data.firstSeen,
    lastSeen: data.lastSeen,
  })).sort((a, b) => b.totalInteractions - a.totalInteractions);
}

function getRiskLevel(profile: AdversaryProfile): { level: string; color: string; bg: string } {
  const fieldCount = profile.knownFields.length;
  const catCount = profile.categories.length;
  const hasIdentity = profile.knownFields.some((f) =>
    f.includes('name') || f.includes('email') || f.includes('passport') || f.includes('dob')
  );
  const hasPayment = profile.knownFields.some((f) =>
    f.includes('card') || f.includes('billing')
  );

  if (hasIdentity && hasPayment) return { level: 'Critical', color: 'text-rose-400', bg: 'bg-rose-500/15' };
  if (fieldCount >= 5 || catCount >= 3) return { level: 'High', color: 'text-amber-400', bg: 'bg-amber-500/15' };
  if (fieldCount >= 3 || catCount >= 2) return { level: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
  return { level: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
}

const ALL_IDENTITY_FIELDS = [
  'full_name', 'email', 'phone', 'dob', 'passport_number', 'passport_country',
  'nationality', 'card_number', 'expiry', 'cvv', 'billing_name', 'billing_address',
  'shipping_address', 'api_key', 'api_secret', 'endpoint', 'username', 'password',
  'token', 'blood_type', 'allergies', 'medications', 'conditions', 'emergency_contact',
  'language', 'currency', 'timezone', 'dietary_restrictions', 'accessibility_needs',
];

function AdversaryCard({ profile }: { profile: AdversaryProfile }) {
  const [expanded, setExpanded] = useState(false);
  const risk = getRiskLevel(profile);
  const hiddenFields = ALL_IDENTITY_FIELDS.filter((f) => !profile.knownFields.includes(f));

  return (
    <div className="rounded-xl border border-sky-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className={`w-10 h-10 rounded-xl ${risk.bg} flex items-center justify-center flex-shrink-0`}>
          <Server size={18} className={risk.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono text-slate-900 dark:text-white">{truncate(profile.service)}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${risk.bg} ${risk.color}`}>
              {risk.level} Risk
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-500">
            <span>{profile.totalInteractions} interactions</span>
            <span>{profile.knownFields.length} fields known</span>
            {profile.totalSpend > 0 && <span>${profile.totalSpend.toFixed(2)} transacted</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.categories.map((cat) => (
            <CategoryIcon key={cat} category={cat} size={12} />
          ))}
          {expanded ? <ChevronUp size={14} className="text-slate-400 dark:text-slate-600" /> : <ChevronDown size={14} className="text-slate-400 dark:text-slate-600" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-slate-800/60 px-4 py-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                <Eye size={12} /> What this service knows about you
              </p>
              <div className="space-y-1">
                {profile.knownFields.length === 0 ? (
                  <p className="text-xs text-slate-600 dark:text-slate-600">No fields have been revealed to this service</p>
                ) : (
                  profile.knownFields.map((field) => (
                    <div key={field} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400 flex-shrink-0" />
                      <span className="text-rose-700 dark:text-rose-300">{field.replace(/_/g, ' ')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                <EyeOff size={12} /> What remains hidden
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {hiddenFields.slice(0, 12).map((field) => (
                  <div key={field} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-300/70">{field.replace(/_/g, ' ')}</span>
                  </div>
                ))}
                {hiddenFields.length > 12 && (
                  <p className="text-xs text-slate-600 dark:text-slate-600 mt-1">+{hiddenFields.length - 12} more fields protected</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40 border border-sky-200 dark:border-slate-700/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-600 dark:text-slate-500">First seen</span>
                <p className="text-slate-900 dark:text-white">{new Date(profile.firstSeen).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-500">Last seen</span>
                <p className="text-slate-900 dark:text-white">{new Date(profile.lastSeen).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-500">Categories</span>
                <div className="flex gap-1 mt-0.5">
                  {profile.categories.map((cat) => (
                    <Badge key={cat} size="sm">{CATEGORY_LABELS[cat].split(' ')[0]}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-500">Correlation risk</span>
                <p className={risk.color}>{risk.level}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: PrivacyRecommendation }) {
  const navigate = useNavigate();
  const severityStyles = {
    high: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', color: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500 dark:bg-rose-400' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500 dark:bg-amber-400' },
    low: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', color: 'text-cyan-600 dark:text-cyan-400', dot: 'bg-cyan-500 dark:bg-cyan-400' },
  };
  const s = severityStyles[rec.severity];

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-4 transition-all hover:border-sky-300 dark:hover:border-slate-600/40`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className={`text-xs font-semibold uppercase ${s.color}`}>{rec.severity}</span>
          {rec.category && <Badge variant="default" size="sm">{CATEGORY_LABELS[rec.category].split(' ')[0]}</Badge>}
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">{rec.title}</h3>
      <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed mb-3">{rec.description}</p>
      <button
        onClick={() => navigate(rec.actionRoute)}
        className="flex items-center gap-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
      >
        {rec.actionLabel} <ArrowRight size={11} />
      </button>
    </div>
  );
}

export function ForensicsPage() {
  const { vaultId, addToast } = useApp();
  const [logs, setLogs] = useState<DisclosureLog[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [budgets, setBudgets] = useState<PrivacyBudget[]>([]);
  const [personas, setPersonas] = useState<EphemeralPersona[]>([]);
  const [deadMan, setDeadMan] = useState<DeadManSwitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'adversary' | 'reality' | 'advisor'>('adversary');

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const [l, p, b, per, dm] = await Promise.all([
        loadDisclosureLogs(vaultId),
        loadPolicies(vaultId),
        loadBudgets(vaultId),
        loadPersonas(vaultId),
        loadDeadManSwitch(vaultId),
      ]);
      setLogs(l);
      setPolicies(p);
      setBudgets(b);
      setPersonas(per);
      setDeadMan(dm);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load forensics data', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const profiles = buildAdversaryProfiles(logs, policies);
  const totalFieldsExposed = new Set(profiles.flatMap((p) => p.knownFields)).size;
  const totalFieldsProtected = ALL_IDENTITY_FIELDS.length - totalFieldsExposed;
  const criticalCount = profiles.filter((p) => getRiskLevel(p).level === 'Critical').length;
  const highCount = profiles.filter((p) => getRiskLevel(p).level === 'High').length;
  const recommendations = generateRecommendations(policies, logs, budgets, personas, deadMan);
  const privacyGrade = computePrivacyGrade(recommendations);
  const highRecs = recommendations.filter((r) => r.severity === 'high').length;

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-sky-50 dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Privacy Forensics</h1>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">See what adversaries know vs. what you've kept hidden</p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800/60 border border-sky-200 dark:border-slate-700/40 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('adversary')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'adversary' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Eye size={12} className="inline mr-1" /> Adversary View
          </button>
          <button
            onClick={() => setViewMode('reality')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'reality' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Shield size={12} className="inline mr-1" /> Your Reality
          </button>
          <button
            onClick={() => setViewMode('advisor')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all relative ${
              viewMode === 'advisor' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Lightbulb size={12} className="inline mr-1" /> Advisor
            {highRecs > 0 && viewMode !== 'advisor' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {highRecs}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
          <div className="flex items-center gap-2 mb-1">
            <Server size={13} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs text-slate-600 dark:text-slate-500">Services</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{profiles.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600">have your data</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={13} className="text-rose-600 dark:text-rose-400" />
            <span className="text-xs text-slate-600 dark:text-slate-500">Fields exposed</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalFieldsExposed}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600">across all services</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
          <div className="flex items-center gap-2 mb-1">
            <EyeOff size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs text-slate-600 dark:text-slate-500">Fields protected</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalFieldsProtected}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600">still hidden</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 hover:border-sky-300 dark:hover:border-slate-700/40 transition-all">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-slate-600 dark:text-slate-500">High risk</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{criticalCount + highCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600">services flagged</p>
        </div>
      </div>

      {viewMode === 'adversary' ? (
        <>
          {(criticalCount > 0 || highCount > 0) && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2">
              <AlertTriangle size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-rose-300 font-medium">Privacy Risk Detected</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {criticalCount > 0 && `${criticalCount} service(s) have both identity and payment data. `}
                  {highCount > 0 && `${highCount} service(s) know 5+ fields about you. `}
                  Consider tightening policies or using ephemeral personas to reduce exposure.
                </p>
              </div>
            </div>
          )}

          <div className="mb-4 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <div className="flex items-start gap-2">
              <Search size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-rose-300 font-medium">Adversary's View</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This shows what each service could reconstruct about you from the data your agents have disclosed.
                  The fewer fields per service, the better your privacy posture.
                </p>
              </div>
            </div>
          </div>

          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-slate-800 flex items-center justify-center mb-4">
                <Fingerprint size={24} className="text-sky-400 dark:text-slate-700" />
              </div>
              <p className="text-slate-700 dark:text-slate-400 font-medium mb-1">No forensics data yet</p>
              <p className="text-slate-600 dark:text-slate-600 text-sm">Run the Live Demo to generate disclosure data for analysis.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <AdversaryCard key={profile.service} profile={profile} />
              ))}
            </div>
          )}
        </>
      ) : viewMode === 'advisor' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-black ${privacyGrade.color}`}>{privacyGrade.grade}</div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Privacy Health Grade</p>
                <p className="text-xs text-slate-600 dark:text-slate-500">
                  {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} found
                  {highRecs > 0 && <span className="text-rose-600 dark:text-rose-400"> -- {highRecs} high priority</span>}
                </p>
              </div>
            </div>
            <Lightbulb size={20} className="text-cyan-600 dark:text-cyan-400 opacity-40" />
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center py-16">
              <Shield size={40} className="mx-auto mb-3 text-emerald-500/40" />
              <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-1">Excellent privacy posture</p>
              <p className="text-xs text-slate-600 dark:text-slate-600">No recommendations at this time. Your vault is well-configured.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-300 font-medium">Your Reality</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Despite {logs.length} disclosures across {profiles.length} services, here's what's actually protected.
                  Your vault holds the complete truth — services only see fragments.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" /> Privacy Score
            </h3>
            <div className="flex items-center gap-6 mb-4">
              <div className="relative flex items-center justify-center">
                <svg width={100} height={100} className="transform -rotate-90">
                  <circle cx={50} cy={50} r={42} fill="none" stroke="#e2e8f0" className="dark:stroke-[#1e293b]" strokeWidth={6} />
                  <circle
                    cx={50} cy={50} r={42} fill="none"
                    stroke="#34d399" strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - (totalFieldsProtected / ALL_IDENTITY_FIELDS.length))}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <span className="absolute text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round((totalFieldsProtected / ALL_IDENTITY_FIELDS.length) * 100)}%
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {totalFieldsProtected}/{ALL_IDENTITY_FIELDS.length}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">fields remain completely hidden from all services</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {(['payment', 'identity', 'credentials', 'health', 'preferences'] as SecretCategory[]).map((cat) => {
                const catFields = ALL_IDENTITY_FIELDS.filter((f) => {
                  const catFieldMap: Record<SecretCategory, string[]> = {
                    payment: ['card_number', 'expiry', 'cvv', 'billing_name', 'billing_address', 'shipping_address'],
                    identity: ['full_name', 'email', 'phone', 'dob', 'passport_number', 'passport_country', 'nationality'],
                    credentials: ['api_key', 'api_secret', 'endpoint', 'username', 'password', 'token'],
                    health: ['blood_type', 'allergies', 'medications', 'conditions', 'emergency_contact'],
                    preferences: ['language', 'currency', 'timezone', 'dietary_restrictions', 'accessibility_needs'],
                  };
                  return catFieldMap[cat]?.includes(f);
                });
                const exposedInCat = catFields.filter((f) =>
                  profiles.some((p) => p.knownFields.includes(f))
                ).length;
                const colors = CATEGORY_COLORS[cat];

                return (
                  <div key={cat} className="flex items-center gap-3 p-2 rounded-lg bg-sky-50 dark:bg-slate-800/30">
                    <CategoryIcon category={cat} size={12} />
                    <div className="flex-1">
                      <p className="text-xs text-slate-700 dark:text-slate-300">{CATEGORY_LABELS[cat]}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1 bg-sky-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${catFields.length > 0 ? ((catFields.length - exposedInCat) / catFields.length) * 100 : 100}%`,
                              backgroundColor: colors.icon.includes('emerald') ? '#34d399' : colors.icon.includes('blue') ? '#60a5fa' : colors.icon.includes('amber') ? '#fbbf24' : colors.icon.includes('rose') ? '#fb7185' : '#38bdf8',
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-500">{catFields.length - exposedInCat}/{catFields.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Activity size={14} className="text-cyan-600 dark:text-cyan-400" /> Disclosure Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40">
                <p className="text-slate-600 dark:text-slate-500 mb-1">Total disclosures</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{logs.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40">
                <p className="text-slate-600 dark:text-slate-500 mb-1">Unique services</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{profiles.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40">
                <p className="text-slate-600 dark:text-slate-500 mb-1">Total spend</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">${profiles.reduce((s, p) => s + p.totalSpend, 0).toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40">
                <p className="text-slate-600 dark:text-slate-500 mb-1">Active policies</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{policies.filter((p) => p.active).length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
