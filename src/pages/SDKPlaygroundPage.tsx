import { useState, useEffect } from 'react';
import { Code, Play, Copy, CheckCircle, Book, Github, Terminal, Zap, GitBranch, Shield, Clock, ArrowRight, Check, X, Share2, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { CodeSnippetCard } from '../components/ui/CodeSnippetCard';
import { useApp } from '../context/AppContext';

export function SDKPlaygroundPage() {
  const { addToast, walletAddress } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'status' | 'poll'>('request');
  const [requestId, setRequestId] = useState('');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const [showComparison, setShowComparison] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    const interval = setInterval(() => {
      setFlowStep((prev) => (prev + 1) % 5);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  function copyCode(code: string, label: string) {
    navigator.clipboard.writeText(code);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  const installCode = `npm install @shadowkey/agent-sdk`;

  const quickStartCode = `import { ShadowKeyClient } from '@shadowkey/agent-sdk';

const client = new ShadowKeyClient({
  apiUrl: '${supabaseUrl}/functions/v1',
  apiKey: 'your_api_key_here'
});

// Request access
const response = await client.requestAccess({
  agentId: 'my-agent-001',
  agentName: 'My AI Assistant',
  requestedFields: ['email', 'name'],
  purpose: 'Send you a confirmation'
});

// Wait for approval
const result = await client.waitForApproval(response.requestId);
console.log('Granted data:', result.grantedData);`;

  const requestExample = `POST ${supabaseUrl}/functions/v1/sdk-access-request
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "agentId": "demo-agent-001",
  "agentName": "Demo Agent",
  "requestedFields": ["email", "name"],
  "purpose": "Test the ShadowKey SDK",
  "category": "demo"
}`;

  const statusExample = `GET ${supabaseUrl}/functions/v1/sdk-access-status/REQUEST_ID
Authorization: Bearer YOUR_API_KEY`;

  async function testRequest() {
    if (!walletAddress) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      addToast('In a real implementation, this would use your API key to make the request', 'info');

      const newRequestId = crypto.randomUUID();
      setRequestId(newRequestId);

      setResponse(JSON.stringify({
        requestId: newRequestId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        message: 'Access request created. User will be notified.'
      }, null, 2));

      addToast('Request simulated successfully', 'success');
    } catch (err: unknown) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      addToast('Request failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function testStatus() {
    if (!requestId) {
      addToast('Please enter a request ID', 'warning');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      addToast('In a real implementation, this would check the status of your request', 'info');

      setResponse(JSON.stringify({
        requestId,
        status: 'pending',
        message: 'Request is still pending approval'
      }, null, 2));

      addToast('Status checked successfully', 'success');
    } catch (err: unknown) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      addToast('Status check failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  const flowSteps = [
    { label: 'Agent Requests', icon: Code, color: 'sky' },
    { label: 'SDK Sends', icon: ArrowRight, color: 'cyan' },
    { label: 'User Approves', icon: Shield, color: 'emerald' },
    { label: 'Data Released', icon: CheckCircle, color: 'teal' },
    { label: 'Agent Receives', icon: Zap, color: 'sky' }
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">SDK Playground</h1>
        <p className="text-sm text-slate-600 dark:text-slate-500">
          Test the ShadowKey Agent SDK and explore integration examples
        </p>
      </div>

      {/* Animated Request Flow */}
      <div className="bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-900/40 dark:to-slate-800/40 border border-sky-200 dark:border-slate-800/60 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch size={16} className="text-sky-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Request Flow Animation</h2>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {flowSteps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === flowStep;
            const isPast = idx < flowStep;

            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? 'bg-sky-500 dark:bg-cyan-500 scale-110 shadow-lg'
                    : isPast
                    ? 'bg-emerald-400 dark:bg-emerald-600'
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}>
                  <Icon size={20} className={
                    isActive || isPast ? 'text-white' : 'text-slate-400 dark:text-slate-600'
                  } />
                </div>
                <p className={`text-xs text-center transition-colors ${
                  isActive
                    ? 'text-sky-600 dark:text-cyan-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-500'
                }`}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Flow Timeline */}
        <div className="relative h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-sky-500 to-cyan-500 dark:from-cyan-500 dark:to-teal-500 transition-all duration-500"
            style={{ width: `${((flowStep + 1) / 5) * 100}%` }}
          />
        </div>

        <div className="mt-4 text-xs text-slate-600 dark:text-slate-500 text-center">
          Watch how data flows from agent request to secure approval
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch size={16} className="text-sky-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Architecture Overview</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Agent */}
          <div className="bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-sky-200 dark:border-sky-800/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500 dark:bg-cyan-500 flex items-center justify-center">
                <Code size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your Agent</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              AI agent, bot, or service that needs user data
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Install SDK</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Request fields</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Wait for approval</span>
              </div>
            </div>
          </div>

          {/* SDK/API */}
          <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 dark:bg-teal-500 flex items-center justify-center">
                <Terminal size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">ShadowKey SDK</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Secure middleware handling all privacy logic
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Auth & encryption</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Request routing</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Status polling</span>
              </div>
            </div>
          </div>

          {/* User */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 dark:bg-teal-500 flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">User Dashboard</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Privacy-first UI for reviewing requests
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Review request</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Approve/deny</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Check size={12} className="text-emerald-500" />
                <span>Track usage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Flow Arrows */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-600">
          <span>Agent</span>
          <ArrowRight size={14} />
          <span>SDK</span>
          <ArrowRight size={14} />
          <span>User</span>
          <ArrowRight size={14} />
          <span>Approval</span>
          <ArrowRight size={14} />
          <span>Data</span>
        </div>
      </div>

      {/* SDK vs Direct API Comparison */}
      <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">SDK vs Direct API</h2>
          </div>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs text-sky-600 dark:text-cyan-400 hover:underline"
          >
            {showComparison ? 'Hide' : 'Show'} Comparison
          </button>
        </div>

        {showComparison && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center justify-center gap-2">
                      <Terminal size={14} />
                      <span>ShadowKey SDK</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Code size={14} />
                      <span>Direct API</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Setup Time</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> 5 minutes
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-500">30+ minutes</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Authentication</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Built-in
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-500">
                      <X size={14} /> Manual
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Polling Logic</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Automatic
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-500">
                      <X size={14} /> Write your own
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Error Handling</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Comprehensive
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-500">
                      <X size={14} /> Custom logic
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">TypeScript Types</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Included
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-500">
                      <X size={14} /> Define yourself
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Code Lines</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> ~10 lines
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-500">100+ lines</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Maintenance</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Auto-updated
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-500">
                      <X size={14} /> Your responsibility
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">Testing</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Battle-tested
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-500">
                      <X size={14} /> Write tests
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                <strong className="text-emerald-600 dark:text-emerald-400">Recommended:</strong> Use the SDK for faster development, better error handling, and automatic updates. Direct API is only needed for custom integrations or specific requirements.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <a
          href="https://github.com/kimboltpro3-create/shadowkey"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl hover:border-sky-300 dark:hover:border-slate-700 transition-colors"
        >
          <Github size={20} className="text-sky-600 dark:text-cyan-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">GitHub</p>
            <p className="text-xs text-slate-600 dark:text-slate-500">View source code</p>
          </div>
        </a>

        <a
          href="https://github.com/kimboltpro3-create/shadowkey/blob/main/DEVELOPER_GUIDE.md"
          target="_blank"
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl hover:border-sky-300 dark:hover:border-slate-700 transition-colors"
        >
          <Book size={20} className="text-sky-600 dark:text-cyan-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Documentation</p>
            <p className="text-xs text-slate-600 dark:text-slate-500">Complete guide</p>
          </div>
        </a>

        <button
          onClick={() => {
            const examplesSection = document.getElementById('integration-examples');
            examplesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl hover:border-sky-300 dark:hover:border-slate-700 transition-colors text-left w-full"
        >
          <Code size={20} className="text-sky-600 dark:text-cyan-400" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Examples</p>
            <p className="text-xs text-slate-600 dark:text-slate-500">Integration samples</p>
          </div>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal size={16} className="text-sky-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Start</h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Installation</label>
              <button
                onClick={() => copyCode(installCode, 'install')}
                className="text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400"
              >
                {copied === 'install' ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="bg-slate-950 text-emerald-400 p-3 rounded-lg text-xs overflow-x-auto">
              {installCode}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Basic Usage</label>
              <button
                onClick={() => copyCode(quickStartCode, 'quickstart')}
                className="text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400"
              >
                {copied === 'quickstart' ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="bg-slate-950 text-cyan-400 p-3 rounded-lg text-xs overflow-x-auto">
              {quickStartCode}
            </pre>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-sky-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">API Examples</h2>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('request')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'request'
                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-cyan-400'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Request Access
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'status'
                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-cyan-400'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Check Status
          </button>
          <button
            onClick={() => setActiveTab('poll')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'poll'
                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-cyan-400'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Wait for Approval
          </button>
        </div>

        <div>
          {activeTab === 'request' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">POST /sdk-access-request</label>
                <button
                  onClick={() => copyCode(requestExample, 'request')}
                  className="text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400"
                >
                  {copied === 'request' ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <pre className="bg-slate-950 text-slate-300 p-3 rounded-lg text-xs overflow-x-auto mb-3">
                {requestExample}
              </pre>
              <Button variant="primary" size="sm" onClick={testRequest} loading={loading}>
                <Play size={12} /> Test Request
              </Button>
            </div>
          )}

          {activeTab === 'status' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">GET /sdk-access-status/:requestId</label>
                <button
                  onClick={() => copyCode(statusExample, 'status')}
                  className="text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400"
                >
                  {copied === 'status' ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <pre className="bg-slate-950 text-slate-300 p-3 rounded-lg text-xs overflow-x-auto mb-3">
                {statusExample}
              </pre>
              <input
                type="text"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                placeholder="Enter request ID"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-cyan-400 text-slate-900 dark:text-white mb-2"
              />
              <Button variant="primary" size="sm" disabled={!requestId} onClick={testStatus} loading={loading}>
                <Play size={12} /> Check Status
              </Button>
            </div>
          )}

          {activeTab === 'poll' && (
            <div>
              <div className="mb-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">SDK Method: waitForApproval()</label>
              </div>
              <pre className="bg-slate-950 text-cyan-400 p-3 rounded-lg text-xs overflow-x-auto">
{`const result = await client.waitForApproval(
  requestId,
  300000,  // Max wait: 5 minutes
  2000     // Poll every 2 seconds
);

if (result.status === 'approved') {
  console.log('Granted:', result.grantedData);
}`}
              </pre>
              <p className="text-xs text-slate-600 dark:text-slate-500 mt-3">
                This method automatically polls the status endpoint until the request is approved, denied, or expires.
              </p>
            </div>
          )}

          {response && (
            <div className="mt-4">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">Response</label>
              <pre className="bg-slate-950 text-emerald-400 p-3 rounded-lg text-xs overflow-x-auto">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Shareable Code Snippets */}
      <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Shareable Code Graphics</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-500">Perfect for social media & docs</p>
        </div>

        <div className="space-y-6">
          <CodeSnippetCard
            title="Quick Start"
            description="Get started with ShadowKey SDK in 3 lines"
            language="typescript"
            gradient="from-sky-500 to-cyan-500"
            code={`const client = new ShadowKeyClient({ apiUrl, apiKey });
const response = await client.requestAccess({ ... });
const data = await client.waitForApproval(response.requestId);`}
          />

          <CodeSnippetCard
            title="Request & Wait Pattern"
            description="Privacy-first data access for AI agents"
            language="typescript"
            gradient="from-cyan-500 to-teal-500"
            code={`// Request access to user data
const { requestId } = await client.requestAccess({
  agentId: 'shopping-bot',
  requestedFields: ['email', 'address'],
  purpose: 'Complete your order'
});

// Wait for user approval
const result = await client.waitForApproval(requestId);
console.log('Granted:', result.grantedData);`}
          />

          <CodeSnippetCard
            title="OpenRouter Integration"
            description="AI agent with privacy controls"
            language="javascript"
            gradient="from-emerald-500 to-teal-500"
            code={`// AI determines what data it needs
const fields = await aiAgent.chat([{
  role: 'user',
  content: 'What fields do you need to help me?'
}]);

// Request only what's needed
const access = await shadowKey.requestAccess({
  agentId: 'openrouter-agent',
  requestedFields: JSON.parse(fields),
  purpose: 'Personalized assistance'
});`}
          />
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg border border-sky-200 dark:border-sky-800/40">
          <div className="flex items-start gap-3">
            <Download size={16} className="text-sky-600 dark:text-cyan-400 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-white mb-1">
                Tip: Take screenshots of these cards for sharing
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                These graphics are designed to look great on Twitter, LinkedIn, and in documentation. Click copy to grab the code.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div id="integration-examples" className="bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-900/40 dark:to-slate-800/40 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4 md:p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Integration Examples</h3>
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900/60 rounded-lg p-3 border border-sky-200 dark:border-slate-800/60">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">OpenRouter Integration</p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mb-2">
              AI agent using free models (Gemini 2.0 Flash) with ShadowKey SDK
            </p>
            <code className="text-xs text-sky-600 dark:text-cyan-400">examples/openrouter/shopping-agent.js</code>
          </div>

          <div className="bg-white dark:bg-slate-900/60 rounded-lg p-3 border border-sky-200 dark:border-slate-800/60">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Express.js Backend</p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mb-2">
              REST API server with request tracking and webhook support
            </p>
            <code className="text-xs text-sky-600 dark:text-cyan-400">examples/node-express/server.js</code>
          </div>
        </div>
      </div>
    </div>
  );
}
