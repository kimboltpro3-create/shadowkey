import { useState } from 'react';
import { ShoppingCart, Plane, Heart, Calendar, Shield, ArrowRight, CheckCircle, Lock, Eye } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface Scenario {
  id: string;
  icon: React.ElementType;
  title: string;
  problem: string;
  solution: string;
  color: string;
  bgColor: string;
  steps: {
    step: string;
    description: string;
    highlight: string;
  }[];
  outcome: string;
}

const scenarios: Scenario[] = [
  {
    id: 'shopping',
    icon: ShoppingCart,
    title: 'Shop Online Without Exposing Your Full Credit Card',
    problem: 'You want an AI shopping assistant to buy things for you, but you don\'t want to give it your full credit card details permanently.',
    solution: 'ShadowKey lets the agent see only your shipping address and card expiry, with a $50 spending limit per transaction.',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'from-cyan-500/10 to-cyan-600/10 border-cyan-500/20',
    steps: [
      {
        step: 'Store Payment Card',
        description: 'Encrypt your credit card in the vault: card number, CVV, expiry, billing address.',
        highlight: 'AES-256-GCM encryption in browser'
      },
      {
        step: 'Create Policy',
        description: 'Allow "Shopping Agent" to access payment category with $50/txn limit, reveal only shipping address and expiry.',
        highlight: 'Card number and CVV stay hidden'
      },
      {
        step: 'Agent Requests Access',
        description: 'Shopping agent finds a USB cable for $19.99 and requests payment data.',
        highlight: 'Server validates policy and budget'
      },
      {
        step: 'Scoped Access Granted',
        description: 'Agent receives ONLY shipping address and expiry. No card number, no CVV, no billing name.',
        highlight: 'Zero-knowledge disclosure'
      }
    ],
    outcome: 'Your AI assistant can shop for you, but can never see your full card details or exceed spending limits.'
  },
  {
    id: 'travel',
    icon: Plane,
    title: 'Let Travel AI Book Flights Without Seeing Your Passport',
    problem: 'Travel booking agents need some identity data, but you don\'t want them harvesting your passport number and personal details.',
    solution: 'Use an ephemeral persona that gives fake contact info while revealing only essential fields like passport country.',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'from-teal-500/10 to-teal-600/10 border-teal-500/20',
    steps: [
      {
        step: 'Store Identity Data',
        description: 'Add passport number, DOB, full name, email, and nationality to your vault.',
        highlight: 'Encrypted client-side'
      },
      {
        step: 'Create Ephemeral Persona',
        description: 'Spawn a temporary identity that substitutes your email with a throwaway, expires in 7 days.',
        highlight: 'Breaks metadata correlation'
      },
      {
        step: 'Set Policy with Persona',
        description: 'Allow "Travel Agent" to access identity category, but only reveal passport_country. Hide name, DOB, passport number.',
        highlight: 'Selective disclosure + persona'
      },
      {
        step: 'Agent Books Flight',
        description: 'Travel AI gets passport country and the throwaway email from your persona. Real name and passport number stay hidden.',
        highlight: 'Minimal exposure, maximum privacy'
      }
    ],
    outcome: 'Travel agents can book your flight without seeing your passport number or real contact details.'
  },
  {
    id: 'health',
    icon: Heart,
    title: 'Share Health Data With Apps, Not Insurance Companies',
    problem: 'Fitness apps want access to your health data, but you fear they\'ll sell it to insurance companies or advertisers.',
    solution: 'Control exactly which health metrics each app can see, with time-limited access and instant revocation.',
    color: 'text-rose-400',
    bgColor: 'from-rose-500/10 to-rose-600/10 border-rose-500/20',
    steps: [
      {
        step: 'Store Health Metrics',
        description: 'Add medical records, fitness data, prescriptions, and biometrics to your vault.',
        highlight: 'HIPAA-grade encryption'
      },
      {
        step: 'Create App Policy',
        description: 'Let "FitTracker AI" see only steps, heart_rate, and sleep_hours. Hide medical history, prescriptions, weight.',
        highlight: 'Field-level granularity'
      },
      {
        step: 'Set Privacy Budget',
        description: 'Limit health disclosures to 10/day, 3 unique services. Prevent data harvesting by multiple apps.',
        highlight: 'Disclosure rate limiting'
      },
      {
        step: 'Instant Revocation',
        description: 'If FitTracker changes ownership or privacy policy, revoke access in 1 click. All future requests denied.',
        highlight: 'Dead man switch or manual revoke'
      }
    ],
    outcome: 'You get personalized health insights without giving apps the data they\'d sell to insurers.'
  },
  {
    id: 'productivity',
    icon: Calendar,
    title: 'Give AI Assistant Calendar Access, Not Email Content',
    problem: 'You want an AI assistant to schedule meetings, but you don\'t want it reading your private emails or financial messages.',
    solution: 'Grant access to calendar events only. Emails, documents, and financial data stay locked.',
    color: 'text-amber-400',
    bgColor: 'from-amber-500/10 to-amber-600/10 border-amber-500/20',
    steps: [
      {
        step: 'Store Productivity Data',
        description: 'Add calendar, emails, documents, API keys, and financial data to separate categories.',
        highlight: 'Category-based organization'
      },
      {
        step: 'Create Calendar-Only Policy',
        description: 'Let "Scheduling Assistant" access calendar category only. Email and financial categories remain off-limits.',
        highlight: 'Category isolation'
      },
      {
        step: 'Agent Schedules Meetings',
        description: 'AI sees your calendar availability and books meetings. It never touches your inbox or bank data.',
        highlight: 'Principle of least privilege'
      },
      {
        step: 'Add Budget Cap',
        description: 'Limit calendar disclosures to 50/day to prevent AI from leaking your entire schedule to advertisers.',
        highlight: 'Metadata protection'
      }
    ],
    outcome: 'Your AI assistant is productive without becoming a surveillance vector for your entire digital life.'
  },
  {
    id: 'emergency',
    icon: Shield,
    title: 'Protect Elderly Parent With Auto-Revoke If Unresponsive',
    problem: 'An elderly parent uses AI assistants but may not recognize if they\'re being exploited. You want automatic protection.',
    solution: 'Enable dead man\'s switch requiring weekly check-in. If they don\'t respond, all AI access is automatically revoked.',
    color: 'text-emerald-400',
    bgColor: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20',
    steps: [
      {
        step: 'Store Sensitive Data',
        description: 'Add banking info, passwords, medical records, and identity documents to the vault.',
        highlight: 'Centralized protection'
      },
      {
        step: 'Enable Dead Man Switch',
        description: 'Set 7-day check-in interval with 24-hour warning. If no check-in, all policies are auto-revoked.',
        highlight: 'Automatic protection'
      },
      {
        step: 'Grant AI Access',
        description: 'Allow helpful AI assistants (shopping, health, finance) with policies. Everything works normally.',
        highlight: 'Normal operation'
      },
      {
        step: 'Miss Check-In → Auto-Lockdown',
        description: 'If parent doesn\'t check in for 7 days (hospital, emergency, exploitation), ALL AI access is instantly cut off.',
        highlight: 'Zero access until restored'
      }
    ],
    outcome: 'AI assistants remain helpful until something goes wrong, then automatic protection kicks in.'
  },
];

export function ScenariosPage() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const selected = scenarios.find((s) => s.id === selectedScenario);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <nav className="flex items-center justify-between mb-12">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">ShadowKey</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="/demo" className="text-sm text-slate-400 hover:text-slate-900 dark:text-white transition-colors">
              Live Demo
            </a>
            <Button size="sm" onClick={() => window.location.href = '/connect'}>
              Get Started
            </Button>
          </div>
        </nav>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">Real-World Use Cases</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            See how ShadowKey protects your data in everyday scenarios
          </p>
        </div>

        {!selected ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario.id)}
                className={`p-6 rounded-2xl bg-gradient-to-br ${scenario.bgColor} border text-left hover:scale-105 transition-transform`}
              >
                <div className="w-12 h-12 rounded-xl bg-slate-950/60 flex items-center justify-center mb-4">
                  <scenario.icon size={24} className={scenario.color} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{scenario.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{scenario.problem}</p>
                <div className="flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400">
                  Learn More <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <Button variant="outline" size="sm" onClick={() => setSelectedScenario(null)} className="mb-6">
              <ArrowRight size={14} className="rotate-180" />
              Back to Scenarios
            </Button>

            <div className={`p-8 rounded-2xl bg-gradient-to-br ${selected.bgColor} border mb-8`}>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl bg-slate-950/60 flex items-center justify-center flex-shrink-0">
                  <selected.icon size={32} className={selected.color} />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selected.title}</h2>
                  <p className="text-slate-300 mb-4">{selected.problem}</p>
                  <div className="flex items-start gap-2">
                    <CheckCircle size={20} className={`${selected.color} flex-shrink-0 mt-0.5`} />
                    <p className="text-slate-900 dark:text-white font-medium">{selected.solution}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">How It Works</h3>
              <div className="space-y-4">
                {selected.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-slate-900 dark:text-white font-bold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      {i < selected.steps.length - 1 && (
                        <div className="w-px h-full bg-slate-800 mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{step.step}</h4>
                          {i === 1 && <Lock size={16} className="text-cyan-600 dark:text-cyan-400" />}
                          {i === 3 && <Eye size={16} className="text-teal-600 dark:text-teal-400" />}
                        </div>
                        <p className="text-sm text-slate-400 mb-3">{step.description}</p>
                        <div className="px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400">{step.highlight}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle size={24} className="text-emerald-400 flex-shrink-0" />
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">The Outcome</h4>
                  <p className="text-slate-300">{selected.outcome}</p>
                </div>
              </div>
              <Button onClick={() => window.location.href = '/demo'}>
                See It In Action
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
