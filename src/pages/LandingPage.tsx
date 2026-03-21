import { Shield, Lock, Eye, Zap, ArrowRight, Github, Play, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-radial from-cyan-500/10 via-violet-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-gradient-radial from-teal-500/8 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-6">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-24">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Shield size={16} className="text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">ShadowKey</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/kimboltpro3-create/shadowkey"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
              title="GitHub"
            >
              <Github size={18} />
            </a>
            <button
              onClick={() => navigate('/attestations')}
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Attestations
            </button>
            <button
              onClick={() => navigate('/sdk')}
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Agent SDK
            </button>
            <Button variant="outline" size="sm" onClick={() => navigate('/connect')}>
              Launch App
              <ArrowRight size={13} />
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live on Base Mainnet · EAS On-Chain Attestations
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight">
            Watch an AI agent request your data.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-400 to-teal-400">
              You approve. It gets only what you allow.
            </span>
          </h1>

          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Field-level consent. On-chain proof. Revokable in one click.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Button size="lg" onClick={() => navigate('/agent-demo')} className="shadow-lg shadow-cyan-500/20">
              <Play size={16} />
              Try Agent Demo →
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/connect')}>
              Connect Wallet
              <ArrowRight size={15} />
            </Button>
          </div>

          {/* 3-step flow */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0 mb-10">
            {[
              { icon: Zap, label: 'Request', desc: 'Agent asks for specific fields', color: 'cyan' },
              { icon: Shield, label: 'Approve', desc: 'You grant only what you choose', color: 'violet' },
              { icon: CheckCircle, label: 'On-chain proof', desc: 'EAS attestation on Base Mainnet', color: 'teal' },
            ].map(({ icon: Icon, label, desc, color }, i, arr) => (
              <div key={label} className="flex items-center gap-2 sm:gap-0">
                <div className="flex flex-col items-center gap-2 px-6">
                  <div className={`w-10 h-10 rounded-full bg-${color}-500/20 border border-${color}-500/30 flex items-center justify-center`}>
                    <Icon size={18} className={`text-${color}-400`} />
                  </div>
                  <span className={`text-xs font-semibold text-${color}-400 uppercase tracking-wider`}>{label}</span>
                  <span className="text-xs text-slate-500 text-center max-w-[110px]">{desc}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight size={14} className="text-slate-700 hidden sm:block shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            {[
              { dot: 'bg-emerald-400', label: 'AES-256-GCM encrypted' },
              { dot: 'bg-cyan-400', label: 'Supabase stores ciphertext only' },
              { dot: 'bg-violet-400', label: 'On-chain audit trail' },
              { dot: 'bg-teal-400', label: 'Local mode — no Supabase needed' },
            ].map(({ dot, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
          {[
            { value: 'AES-256-GCM', label: 'Encryption standard' },
            { value: 'Base Mainnet', label: 'Chain ID 8453' },
            { value: 'EAS', label: 'On-chain attestations' },
            { value: 'PBKDF2', label: 'Key derivation' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 text-center"
            >
              <p className="text-sm font-bold text-white font-mono mb-1">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-5 mb-20">
          {[
            {
              icon: Lock,
              title: 'Encrypted Vault',
              description:
                'Store payment cards, passwords, API keys, and personal data encrypted with AES-256-GCM. Key derivation (PBKDF2) runs in your browser — Supabase stores ciphertext only, never plaintext or keys.',
              gradient: 'from-cyan-500 to-cyan-600',
              glow: 'group-hover:shadow-cyan-500/20',
            },
            {
              icon: Eye,
              title: 'Policy-Based Access',
              description:
                'AI agents request specific fields. Your policies decide what to reveal, spending limits, and expiry. Every decision is logged as an EAS attestation on Base Mainnet.',
              gradient: 'from-violet-500 to-violet-600',
              glow: 'group-hover:shadow-violet-500/20',
            },
            {
              icon: Shield,
              title: 'Instant Revocation',
              description:
                "Dead man's switch, emergency lockdown, or manual revoke. Kill all agent access in milliseconds. Policies are enforced both in Supabase and on-chain.",
              gradient: 'from-teal-500 to-teal-600',
              glow: 'group-hover:shadow-teal-500/20',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`group p-6 rounded-2xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700 transition-all hover:shadow-xl ${feature.glow}`}
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
              >
                <feature.icon size={22} className="text-white" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-8 mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">How It Works</h2>
            <p className="text-sm text-slate-500">Four steps from vault to verified disclosure</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Store & Encrypt',
                desc: 'Secrets encrypted in your browser before upload. AES-256-GCM with PBKDF2 key derivation.',
                color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
              },
              {
                step: '02',
                title: 'Set Policies',
                desc: 'Define agent permissions: which fields, spending limits, expiry dates, and service allowlists.',
                color: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
              },
              {
                step: '03',
                title: 'Agent Requests',
                desc: 'AI agent calls ShadowKey SDK. You approve or deny on mobile via QR code — no MetaMask needed.',
                color: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
              },
              {
                step: '04',
                title: 'On-Chain Proof',
                desc: 'EAS attestation written to Base Mainnet. Immutable, verifiable audit trail for every disclosure.',
                color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
              },
            ].map((item, i) => (
              <div key={item.step} className="relative flex flex-col gap-3">
                <div className={`w-10 h-10 rounded-xl border ${item.color} flex items-center justify-center font-mono font-bold text-sm`}>
                  {item.step}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
                {i < 3 && (
                  <ArrowRight size={14} className="text-slate-700 absolute -right-4 top-3 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Powered by */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-16 text-xs">
          <span className="text-slate-600 mr-1">Powered by</span>
          {['Base Mainnet', 'Ethereum Attestation Service', 'Supabase', 'Pinata IPFS', 'Viem'].map((tech) => (
            <span key={tech} className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              {tech}
            </span>
          ))}
        </div>

        {/* CTA footer */}
        <div className="text-center p-10 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-violet-500/5 to-teal-500/10 border border-slate-800/60 mb-12">
          <h2 className="text-2xl font-bold text-white mb-3">Take control of your data.</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Stop giving AI agents blanket access. ShadowKey enforces minimum disclosure — cryptographically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate('/agent-demo')}>
              <Play size={16} />
              Try the Demo
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/connect')}>
              Connect Wallet
            </Button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-700 pb-8">
          Built for privacy · Designed for AI agents · Secured by cryptography
        </div>
      </div>
    </div>
  );
}
