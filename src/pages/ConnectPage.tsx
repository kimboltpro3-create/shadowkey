import { useState, useEffect } from 'react';
import { Shield, Lock, Eye, Activity, Zap, ArrowRight, ChevronRight, Database, GitBranch } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';

const FEATURES = [
  {
    icon: Lock,
    title: 'Zero-Knowledge Storage',
    desc: 'AES-GCM 256-bit encryption in the browser. Your vault key is derived from your wallet signature — the server only ever sees ciphertext.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Eye,
    title: 'Granular Disclosure Control',
    desc: 'Define exactly which fields each agent can see, to which services, with per-transaction and cumulative spend limits.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Activity,
    title: 'Immutable Audit Trail',
    desc: 'Every disclosure is logged on-chain. Review exactly what was revealed, to whom, and when — encrypted so only you can read the details.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    icon: Zap,
    title: 'Instant Revocation',
    desc: 'Revoke any agent policy in one click. The smart contract denies all subsequent access requests immediately — no delay.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
];

const FLOW_STEPS = [
  { label: 'Store secrets', sub: 'AES-GCM encrypted', icon: Database },
  { label: 'Set policy', sub: 'On-chain rules', icon: Shield },
  { label: 'Agent acts', sub: 'Scoped access', icon: GitBranch },
  { label: 'You audit', sub: 'Full visibility', icon: Activity },
];

const EXAMPLE_POLICIES = [
  {
    name: 'Shopping Agent',
    fields: [
      { label: 'payment', allowed: true },
      { label: 'shipping address', allowed: true },
      { label: 'full name', allowed: false },
      { label: 'email', allowed: false },
    ],
    limit: '$50/txn · 30 days',
  },
  {
    name: 'Travel Agent',
    fields: [
      { label: 'payment', allowed: true },
      { label: 'passport country', allowed: true },
      { label: 'exact DOB', allowed: false },
      { label: 'email', allowed: false },
    ],
    limit: '$2000/txn · per-trip',
  },
  {
    name: 'Research Agent',
    fields: [
      { label: 'OpenAI key', allowed: true },
      { label: 'Anthropic key', allowed: true },
      { label: 'personal info', allowed: false },
    ],
    limit: 'Any service · 7 days',
  },
];

function AnimatedDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  );
}

export function ConnectPage() {
  const { connectWallet, isConnecting } = useApp();
  const [activePolicy, setActivePolicy] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActivePolicy((v) => (v + 1) % EXAMPLE_POLICIES.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col overflow-x-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-sky-200 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Shield size={14} className="text-cyan-400" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">ShadowKey</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            <AnimatedDot />
            <span className="text-xs text-slate-400">Base Sepolia</span>
          </div>
          <Button onClick={connectWallet} loading={isConnecting} size="sm">
            Connect Wallet
          </Button>
        </div>
      </header>

      <div className="flex-1">
        <section className="px-4 pt-16 pb-12 flex flex-col items-center text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 mb-6">
            <Zap size={11} /> Privacy infrastructure for agentic AI
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            Your secrets,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-sky-500 dark:from-cyan-400 dark:to-teal-400">
              your rules.
            </span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-xl mb-8 leading-relaxed">
            Store encrypted credentials once. Define what each AI agent can access and reveal.
            Audit every disclosure. Revoke access instantly.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <Button onClick={connectWallet} loading={isConnecting} size="lg">
              <Shield size={18} /> Connect Wallet & Unlock Vault
            </Button>
            <button
              onClick={connectWallet}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Try demo mode <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-600">
            Vault key derived from wallet signature — never stored, never transmitted.
          </p>
        </section>

        <section className="px-4 pb-16 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-slate-700/60 flex items-center justify-center">
                    <step.icon size={15} className="text-sky-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{step.label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-600">{step.sub}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight size={14} className="text-slate-400 dark:text-slate-700 mx-3 mb-5 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 max-w-4xl mx-auto">
          <h2 className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500 mb-8">
            Policy examples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EXAMPLE_POLICIES.map((policy, i) => (
              <div
                key={policy.name}
                className={`p-4 rounded-xl border transition-all cursor-default ${
                  activePolicy === i
                    ? 'border-sky-400 dark:border-cyan-500/40 bg-sky-50 dark:bg-cyan-500/5'
                    : 'border-sky-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-sky-100 dark:bg-slate-800 flex items-center justify-center">
                    <GitBranch size={11} className="text-sky-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{policy.name}</span>
                </div>
                <div className="space-y-1.5 mb-3">
                  {policy.fields.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 text-xs">
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${f.allowed ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                        {f.allowed ? '✓' : '✕'}
                      </span>
                      <span className={f.allowed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}>{f.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-600 border-t border-sky-200 dark:border-slate-800/60 pt-2">{policy.limit}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <div key={title} className={`p-4 rounded-xl bg-white dark:bg-slate-900/60 border ${border} hover:bg-sky-50 dark:hover:bg-slate-900/80 transition-all`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon size={15} className={color} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t border-sky-200 dark:border-slate-800/60 py-4 px-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-600">
        <span>ShadowKey — Human-controlled privacy vault for AI agents</span>
        <div className="flex items-center gap-1.5">
          <AnimatedDot />
          <span>Base Sepolia Testnet</span>
        </div>
      </footer>
    </div>
  );
}
