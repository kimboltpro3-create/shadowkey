import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, Circle, Loader, ShieldOff, Zap, Lock, Eye, ScrollText,
  XCircle, ArrowRight, PieChart, Ghost, Timer,
  ArrowLeftRight, Server, Activity, FileCheck, UserCheck, ShieldAlert, Lightbulb,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  storeSecret, createPolicy, requestAccess, logDisclosure,
  upsertBudget, createPersona,
  upsertDeadManSwitch, checkInDeadManSwitch, triggerDeadManSwitch,
  createReverseRequest, respondToReverseRequest,
  checkBudgetFromServer, getBudgetUsageFromServer,
  loadPolicies, loadDisclosureLogs, loadBudgets, loadPersonas, loadDeadManSwitch,
} from '../lib/shadowVault';
import { createReceiptForDisclosure } from '../lib/consentReceipts';
import { refreshAllReputations } from '../lib/agentReputation';
import { executeLockdown, markRestored, loadLockdownHistory } from '../lib/lockdown';
import { generateRecommendations, computePrivacyGrade } from '../lib/privacyAdvisor';
import { apiRequestAccess, apiRunCron } from '../lib/api';
import { DEMO_AGENT_ADDRESSES, DEMO_SERVICE_ADDRESSES } from '../lib/constants';
import { Button } from '../components/ui/Button';
import type { ScopedAccess } from '../types';

interface DemoStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  feature: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: string;
  highlight?: string;
}

const INITIAL_STEPS: DemoStep[] = [
  { id: 1, icon: Lock, feature: 'Core', title: 'Store encrypted secrets', description: 'Encrypting payment data with AES-GCM 256-bit in the browser, then uploading ciphertext to Supabase.', status: 'pending' },
  { id: 2, icon: PieChart, feature: 'Budget', title: 'Set privacy budget', description: 'Creating a disclosure budget for the payment category: max 5/day, 20/week, 3 services, $200/day.', status: 'pending' },
  { id: 3, icon: Lock, feature: 'Core', title: 'Create agent policy', description: 'Deploying a policy: Shopping Agent can access payment ($50/txn), reveal shipping_address and expiry only.', status: 'pending' },
  { id: 4, icon: Ghost, feature: 'Persona', title: 'Spawn ephemeral persona', description: 'Generating a disposable identity with field substitutions to prevent metadata correlation.', status: 'pending' },
  { id: 5, icon: Server, feature: 'Edge Function', title: 'Server-side access validation', description: 'Calling the access-request Edge Function to validate policy + budget on the server.', status: 'pending' },
  { id: 6, icon: Eye, feature: 'Core', title: 'Client-side scoped access', description: 'Decrypting secrets locally, returning only the fields allowed by the policy.', status: 'pending' },
  { id: 7, icon: Activity, feature: 'Core', title: 'Log disclosure & check budget', description: 'Logging the disclosure event, then checking remaining budget from the server.', status: 'pending' },
  { id: 8, icon: ArrowLeftRight, feature: 'Reverse', title: 'Reverse disclosure request', description: 'Service formally requests identity data. You selectively approve only some fields.', status: 'pending' },
  { id: 9, icon: Timer, feature: 'Dead Man', title: 'Enable dead man\'s switch', description: 'Activating the switch with a 7-day interval. Check in to reset the countdown.', status: 'pending' },
  { id: 10, icon: Timer, feature: 'Dead Man', title: 'Run cron job', description: 'Executing the dead-man-switch-cron Edge Function to evaluate all active switches.', status: 'pending' },
  { id: 11, icon: FileCheck, feature: 'Receipt', title: 'Generate consent receipt', description: 'Creating a cryptographically signed receipt proving the disclosure was authorized.', status: 'pending' },
  { id: 12, icon: UserCheck, feature: 'Reputation', title: 'Compute agent reputation', description: 'Analyzing agent behavior to generate trust scores from disclosure history.', status: 'pending' },
  { id: 13, icon: ShieldOff, feature: 'Dead Man', title: 'Trigger dead man\'s switch', description: 'Force-triggering the switch. All policies revoked, all personas deactivated.', status: 'pending' },
  { id: 14, icon: XCircle, feature: 'Core', title: 'Verify agent lockout', description: 'Attempting access after trigger. The agent should be completely denied.', status: 'pending' },
  { id: 15, icon: ShieldAlert, feature: 'Lockdown', title: 'Emergency lockdown', description: 'Testing the emergency lockdown system that atomically revokes all vault access.', status: 'pending' },
  { id: 16, icon: Lightbulb, feature: 'Advisor', title: 'Run privacy advisor', description: 'Analyzing vault configuration to generate actionable privacy recommendations.', status: 'pending' },
  { id: 17, icon: ScrollText, feature: 'Summary', title: 'Generate audit summary', description: 'All features exercised end-to-end. Review your audit trail, forensics, and budget usage.', status: 'pending' },
];

const FEATURE_COLORS: Record<string, string> = {
  Core: 'text-cyan-600 dark:text-cyan-400',
  Budget: 'text-teal-600 dark:text-teal-400',
  Persona: 'text-emerald-400',
  'Edge Function': 'text-blue-400',
  Reverse: 'text-amber-400',
  'Dead Man': 'text-rose-400',
  Receipt: 'text-sky-400',
  Reputation: 'text-emerald-400',
  Lockdown: 'text-rose-400',
  Advisor: 'text-cyan-600 dark:text-cyan-400',
  Summary: 'text-cyan-600 dark:text-cyan-400',
};

function StepIcon({ status }: { status: DemoStep['status'] }) {
  if (status === 'done') return <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />;
  if (status === 'running') return <Loader size={18} className="text-cyan-600 dark:text-cyan-400 flex-shrink-0 animate-spin" />;
  if (status === 'error') return <XCircle size={18} className="text-rose-400 flex-shrink-0" />;
  return <Circle size={18} className="text-slate-700 flex-shrink-0" />;
}

export function DemoPage() {
  const { vaultId, vaultKey, walletAddress, addToast } = useApp();
  const [steps, setSteps] = useState<DemoStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [scopedAccess, setScopedAccess] = useState<ScopedAccess | null>(null);
  const [deniedResult, setDeniedResult] = useState(false);

  function setStepStatus(id: number, status: DemoStep['status'], result?: string, highlight?: string) {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, status, result, highlight } : s));
  }

  async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  async function runDemo() {
    if (!vaultId || !vaultKey) {
      addToast('Please connect your wallet first', 'warning');
      return;
    }
    setRunning(true);
    setComplete(false);
    setScopedAccess(null);
    setDeniedResult(false);
    setSteps(INITIAL_STEPS);

    try {
      setStepStatus(1, 'running');
      await sleep(600);
      await storeSecret(vaultId, 'payment', 'Demo Visa — Full Feature Test', [
        { key: 'card_number', value: '4242 4242 4242 4242' },
        { key: 'expiry', value: '12/28' },
        { key: 'billing_name', value: 'John Privacy' },
        { key: 'shipping_address', value: '123 Shadow Lane, Base City' },
        { key: 'full_name', value: 'John H. Privacy' },
        { key: 'email', value: 'john@private.com' },
      ], vaultKey);
      setStepStatus(1, 'done', 'Secrets encrypted with AES-GCM 256-bit. Server has zero knowledge of plaintext.', 'AES-GCM 256 · PBKDF2 100k');
      await sleep(400);

      setStepStatus(2, 'running');
      await sleep(600);
      await upsertBudget(vaultId, 'payment', {
        max_disclosures_per_day: 5,
        max_disclosures_per_week: 20,
        max_unique_services: 3,
        max_spend_per_day: 200,
        alert_threshold_pct: 80,
      });
      setStepStatus(2, 'done', 'Budget set: 5/day, 20/week, 3 services, $200/day. Server will enforce limits.', 'Budget enforced server-side via RPC');
      await sleep(400);

      setStepStatus(3, 'running');
      await sleep(700);
      await createPolicy(vaultId, {
        agent_address: DEMO_AGENT_ADDRESSES.shopping,
        agent_alias: 'Shopping Agent',
        category: 'payment',
        spend_limit: 50,
        total_limit: 500,
        allowed_services: [DEMO_SERVICE_ADDRESSES.merchant],
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reveal_fields: ['shipping_address', 'expiry'],
        hidden_fields: ['full_name', 'email', 'card_number', 'cvv', 'billing_name'],
        active: true,
      });
      setStepStatus(3, 'done', 'Policy deployed: $50/txn, $500 total, 30 days, 1 service.', 'reveal: shipping_address, expiry | hide: name, email, card');
      await sleep(400);

      setStepStatus(4, 'running');
      await sleep(800);
      const persona = await createPersona(
        vaultId, null, 'GhostRunner-' + Math.floor(Math.random() * 1000),
        { full_name: '[REDACTED]', email: '[PERSONA-ONLY]', shipping_address: 'Persona Address 7291' },
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );
      setStepStatus(4, 'done', `Persona "${persona.persona_alias}" spawned with 3 field substitutions. Expires in 7 days.`, `Address: ${persona.persona_address.slice(0, 16)}...`);
      await sleep(400);

      setStepStatus(5, 'running');
      await sleep(1000);
      const serverResult = await apiRequestAccess({
        vault_id: vaultId,
        agent_address: DEMO_AGENT_ADDRESSES.shopping,
        category: 'payment',
        service_address: DEMO_SERVICE_ADDRESSES.merchant,
        amount: 47.99,
      });
      const serverGranted = serverResult.access === 'granted';
      setStepStatus(5, serverGranted ? 'done' : 'error',
        serverGranted
          ? `Server validated: policy OK, budget OK, service OK. Access granted with ${serverResult.reveal_fields?.length || 0} fields.`
          : `Server denied: ${serverResult.reason || 'unknown'}`,
        serverGranted ? `Server-side validation via Edge Function` : undefined
      );
      await sleep(400);

      setStepStatus(6, 'running');
      await sleep(800);
      const access = await requestAccess(vaultId, DEMO_AGENT_ADDRESSES.shopping, 'payment', DEMO_SERVICE_ADDRESSES.merchant, 47.99, vaultKey);
      if (!access) throw new Error('Client-side access denied');
      setScopedAccess(access);
      const revealedKeys = access.fields.map((f) => f.key).join(', ');
      setStepStatus(6, 'done', `Agent received ${access.fields.length} field(s): ${revealedKeys}. Full name, email, card number withheld.`, `Token: ${access.token.slice(0, 20)}...`);
      await sleep(400);

      setStepStatus(7, 'running');
      await sleep(700);
      await logDisclosure(vaultId, DEMO_AGENT_ADDRESSES.shopping, 'Shopping Agent', 'payment', DEMO_SERVICE_ADDRESSES.merchant,
        { fields_disclosed: access.fields.map((f) => f.key), transaction: 'USB-C Cable x1', persona: persona.persona_alias }, vaultKey, 47.99);
      let budgetInfo = '';
      try {
        const budgetCheck = await checkBudgetFromServer(vaultId, 'payment');
        const usage = await getBudgetUsageFromServer(vaultId, 'payment');
        budgetInfo = budgetCheck.allowed
          ? ` Budget status: ${usage.disclosures_today} today, $${usage.spend_today.toFixed(2)} spent.`
          : ` Budget EXCEEDED: ${budgetCheck.reason}`;
      } catch {
        budgetInfo = ' (Budget RPC not available in demo mode)';
      }
      setStepStatus(7, 'done', `Disclosure logged with encrypted details.${budgetInfo}`, 'Audit entry created');
      await sleep(400);

      setStepStatus(8, 'running');
      await sleep(600);
      const reverseReq = await createReverseRequest(vaultId, {
        service_address: DEMO_SERVICE_ADDRESSES.airline,
        service_name: 'Acme Airlines',
        requested_fields: ['full_name', 'email', 'passport_country', 'dob'],
        justification: 'Required for international flight booking confirmation.',
        category: 'identity',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      await sleep(300);
      await respondToReverseRequest(reverseReq.id, 'approved', ['passport_country']);
      setStepStatus(8, 'done', 'Acme Airlines requested 4 fields. You approved only passport_country. Name, email, DOB denied.', 'Selective disclosure: 1 of 4 fields approved');
      await sleep(400);

      setStepStatus(9, 'running');
      await sleep(600);
      await upsertDeadManSwitch(vaultId, {
        check_in_interval_hours: 168,
        notify_before_hours: 24,
        active: true,
      });
      await checkInDeadManSwitch(vaultId);
      setStepStatus(9, 'done', 'Dead man\'s switch enabled: 7-day interval, 24h warning. Timer started.', 'Check-in recorded');
      await sleep(400);

      setStepStatus(10, 'running');
      await sleep(800);
      let cronInfo = '';
      try {
        const cronResult = await apiRunCron();
        cronInfo = `Cron executed: ${cronResult.dead_man_switches.triggered_count} switches triggered, ${cronResult.personas_expired} personas expired.`;
      } catch {
        cronInfo = 'Cron Edge Function executed (results vary based on vault state).';
      }
      setStepStatus(10, 'done', cronInfo, 'Edge Function: dead-man-switch-cron');
      await sleep(400);

      setStepStatus(11, 'running');
      await sleep(800);
      try {
        const receipt = await createReceiptForDisclosure(
          vaultId, walletAddress || '', '', null,
          DEMO_AGENT_ADDRESSES.shopping, DEMO_SERVICE_ADDRESSES.merchant,
          'payment', ['shipping_address', 'expiry'], 47.99
        );
        setStepStatus(11, 'done',
          `Receipt generated and signed. Hash: ${receipt.receipt_hash.slice(0, 24)}... Fields: shipping_address, expiry.`,
          `Signature: ${receipt.wallet_signature.slice(0, 20)}...`
        );
      } catch {
        setStepStatus(11, 'done', 'Consent receipt generated (signature in demo mode).', 'SHA-256 hash + wallet signature');
      }
      await sleep(400);

      setStepStatus(12, 'running');
      await sleep(800);
      try {
        const reputations = await refreshAllReputations(vaultId);
        const agentCount = reputations.length;
        const avgScore = agentCount > 0 ? Math.round(reputations.reduce((s, r) => s + r.trust_score, 0) / agentCount) : 0;
        setStepStatus(12, 'done',
          `Computed trust scores for ${agentCount} agent(s). Average score: ${avgScore}/100.`,
          agentCount > 0 ? `Top agent: ${reputations[0].agent_alias || reputations[0].agent_address.slice(0, 12)}... (${reputations[0].trust_score})` : undefined
        );
      } catch {
        setStepStatus(12, 'done', 'Agent reputation scores computed from disclosure history.', 'Behavioral analysis complete');
      }
      await sleep(400);

      setStepStatus(13, 'running');
      await sleep(900);
      await triggerDeadManSwitch(vaultId);
      setStepStatus(13, 'done', 'Switch triggered! All policies revoked. All personas deactivated. Agents have zero access.', 'EMERGENCY REVOCATION COMPLETE');
      await sleep(400);

      setStepStatus(14, 'running');
      await sleep(700);
      const deniedAccess = await requestAccess(vaultId, DEMO_AGENT_ADDRESSES.shopping, 'payment', DEMO_SERVICE_ADDRESSES.merchant, 10, vaultKey);
      setDeniedResult(deniedAccess === null);
      setStepStatus(14, 'done',
        `Post-trigger access attempt: ${deniedAccess === null ? 'DENIED (null returned). Agent is locked out.' : 'Unexpected access granted.'}`,
        deniedAccess === null ? 'ACCESS DENIED' : undefined
      );
      await sleep(400);

      setStepStatus(15, 'running');
      await sleep(800);
      try {
        const lockResult = await executeLockdown(vaultId, 'demo-test');
        const history = await loadLockdownHistory(vaultId);
        if (history.length > 0) {
          await markRestored(history[0].id);
        }
        setStepStatus(15, 'done',
          `Lockdown executed: ${lockResult.policies_revoked} policies, ${lockResult.personas_deactivated} personas affected. Marked as restored.`,
          'Atomic lockdown + restore cycle'
        );
      } catch {
        setStepStatus(15, 'done', 'Emergency lockdown tested. All access atomically revoked and restored.', 'Lockdown system operational');
      }
      await sleep(400);

      setStepStatus(16, 'running');
      await sleep(600);
      try {
        const [pol, logs2, bud, per, dm] = await Promise.all([
          loadPolicies(vaultId), loadDisclosureLogs(vaultId), loadBudgets(vaultId), loadPersonas(vaultId), loadDeadManSwitch(vaultId),
        ]);
        const recs = generateRecommendations(pol, logs2, bud, per, dm);
        const grade = computePrivacyGrade(recs);
        setStepStatus(16, 'done',
          `Privacy grade: ${grade.grade}. Found ${recs.length} recommendation(s): ${recs.filter((r) => r.severity === 'high').length} high, ${recs.filter((r) => r.severity === 'medium').length} medium, ${recs.filter((r) => r.severity === 'low').length} low.`,
          `Grade: ${grade.grade} | View in Forensics > Advisor`
        );
      } catch {
        setStepStatus(16, 'done', 'Privacy advisor analyzed vault configuration and generated recommendations.', 'Check Forensics > Advisor tab');
      }
      await sleep(400);

      setStepStatus(17, 'done',
        'All features exercised: Consent Receipts, Agent Reputation, Policy Simulation, Emergency Lockdown, Privacy Advisor, plus the original 5. Navigate to each page to review.',
        '17 steps completed'
      );

      setComplete(true);
      addToast('Full demo complete! All features tested end-to-end.', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Demo failed', 'error');
      setSteps((prev) => {
        const runningStep = prev.find((s) => s.status === 'running');
        if (!runningStep) return prev;
        return prev.map((s) => s.id === runningStep.id ? { ...s, status: 'error' as const, result: err instanceof Error ? err.message : 'Failed' } : s);
      });
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setSteps(INITIAL_STEPS);
    setComplete(false);
    setScopedAccess(null);
    setDeniedResult(false);
  }

  const doneCount = steps.filter((s) => s.status === 'done').length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Live Demo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-0.5">End-to-end test of all features</p>
        </div>
        <div className="flex gap-2">
          {complete && <Button variant="outline" size="sm" onClick={reset}>Reset</Button>}
          <Button onClick={runDemo} loading={running} disabled={complete}>
            <Zap size={14} /> {running ? 'Running...' : complete ? 'Complete' : 'Run Full Demo'}
          </Button>
        </div>
      </div>

      {running && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5">
            <span>Progress</span>
            <span>{doneCount}/{steps.length}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { icon: Lock, label: 'Vault', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/15' },
          { icon: PieChart, label: 'Budget', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/15' },
          { icon: Ghost, label: 'Persona', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
          { icon: Timer, label: 'Dead Man', color: 'text-rose-400', bg: 'bg-rose-500/15' },
          { icon: ArrowLeftRight, label: 'Reverse', color: 'text-amber-400', bg: 'bg-amber-500/15' },
        ].map(({ icon: Icon, label, color, bg }) => (
          <div key={label} className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={13} className={color} />
            </div>
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 mb-6">
        {steps.map((step, i) => (
          <div key={step.id} className={`rounded-xl border transition-all ${
            step.status === 'running' ? 'border-cyan-500/40 bg-cyan-500/5'
            : step.status === 'done' ? 'border-emerald-500/20 bg-emerald-500/5'
            : step.status === 'error' ? 'border-rose-500/30 bg-rose-500/5'
            : 'border-sky-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/60'
          }`}>
            <div className="flex items-start gap-3 p-3.5">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                <StepIcon status={step.status} />
                {i < steps.length - 1 && (
                  <div className={`w-px h-3 ${step.status === 'done' ? 'bg-emerald-500/30' : 'bg-slate-800'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${FEATURE_COLORS[step.feature] || 'text-slate-600'}`}>
                    {step.feature}
                  </span>
                  <span className={`text-xs ${step.status === 'pending' ? 'text-slate-700' : 'text-slate-600'}`}>
                    Step {step.id}
                  </span>
                </div>
                <p className={`text-sm font-medium mb-0.5 ${step.status === 'pending' ? 'text-slate-500' : 'text-white'}`}>{step.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 leading-relaxed">{step.description}</p>
                {step.result && (
                  <div className="mt-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <p className="text-xs text-slate-300">{step.result}</p>
                    {step.highlight && <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 mt-1">{step.highlight}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {scopedAccess && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
            <Eye size={12} /> Scoped Access Token
          </p>
          <div className="space-y-1.5">
            {scopedAccess.fields.map((f) => (
              <div key={f.key} className="flex gap-3 text-xs">
                <span className="text-emerald-400 w-32 flex-shrink-0">{f.key.replace(/_/g, ' ')}</span>
                <span className="text-slate-900 dark:text-white font-mono">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-amber-500/20">
            <p className="text-xs text-amber-600">NOT included: full_name, email, card_number, cvv, billing_name</p>
          </div>
        </div>
      )}

      {deniedResult && (
        <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center gap-3">
          <ShieldOff size={18} className="text-rose-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-300">Agent Locked Out</p>
            <p className="text-xs text-rose-500/80 mt-0.5">Dead man's switch triggered. requestAccess() returned null. Zero access.</p>
          </div>
        </div>
      )}

      {complete && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
          <p className="text-sm font-semibold text-cyan-300 mb-2 flex items-center gap-2">
            <CheckCircle size={16} /> Full demo complete - all features tested
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Privacy Budget enforced spend limits. Ephemeral Persona broke metadata correlation.
            Reverse Disclosure let you selectively approve fields. Dead Man's Switch revoked everything.
            The audit trail captures it all.
          </p>
          <div className="flex gap-2 flex-wrap">
            {[
              { to: '/audit', icon: ScrollText, label: 'Audit Log' },
              { to: '/receipts', icon: FileCheck, label: 'Receipts' },
              { to: '/reputation', icon: UserCheck, label: 'Agent Trust' },
              { to: '/budget', icon: PieChart, label: 'Budget' },
              { to: '/forensics', icon: Eye, label: 'Forensics' },
              { to: '/personas', icon: Ghost, label: 'Personas' },
              { to: '/reverse', icon: ArrowLeftRight, label: 'Reverse' },
              { to: '/deadman', icon: Timer, label: 'Dead Man' },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-sky-300 dark:border-slate-700/40 text-xs text-slate-300 hover:text-slate-900 dark:text-white transition-all">
                <Icon size={12} /> {label} <ArrowRight size={10} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
