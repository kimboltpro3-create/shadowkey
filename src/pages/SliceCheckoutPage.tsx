import { useState } from 'react';
import { ShoppingCart, Shield, CheckCircle, XCircle, AlertTriangle, Lock, Zap, ExternalLink, ChevronRight, Bot, Key } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'connecting' | 'requesting' | 'approved' | 'erc8128' | 'checkout' | 'done' | 'denied';

interface VaultField {
  key: string;
  label: string;
  value: string;
  revealed: boolean;
}

interface AgentLog {
  time: string;
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT = {
  name: 'ShadowKey Pro Access',
  description: 'Unlimited AI agent authorizations, advanced privacy budgets, and on-chain consent receipts.',
  price: '$12.00',
  productId: 'sk-pro-001',
  sliceStoreUrl: 'https://slice.so',
};

const DEMO_VAULT_FIELDS: VaultField[] = [
  { key: 'billing_name',    label: 'Billing Name',     value: 'Alex Privacy',            revealed: false },
  { key: 'shipping_address',label: 'Shipping Address', value: '42 Anon St, Web3 City',   revealed: false },
  { key: 'card_last4',      label: 'Card Last 4',      value: '4242',                    revealed: false },
  { key: 'email',           label: 'Email',            value: 'alex@shadowkey.ai',        revealed: false },
];

const SLICE_GATE_ADDRESS = import.meta.env.VITE_SLICE_GATE_ADDRESS || '0x...SliceShadowKeyGate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString();
}

function LogLine({ entry }: { entry: AgentLog }) {
  const color =
    entry.type === 'success' ? 'text-emerald-400' :
    entry.type === 'warn'    ? 'text-amber-400' :
    entry.type === 'error'   ? 'text-red-400' :
                               'text-gray-400';
  return (
    <div className={`text-xs font-mono ${color}`}>
      [{entry.time}] {entry.text}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SliceCheckoutPage() {
  const [step, setStep] = useState<Step>('idle');
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [fields, setFields] = useState<VaultField[]>(DEMO_VAULT_FIELDS);
  const [approvedFields, setApprovedFields] = useState<string[]>([]);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [erc8128Headers, setErc8128Headers] = useState<Record<string, string> | null>(null);
  const [orderReceipt, setOrderReceipt] = useState<{ txHash: string; receiptId: string } | null>(null);

  function log(text: string, type: AgentLog['type'] = 'info') {
    setLogs(prev => [{ time: now(), type, text }, ...prev]);
  }

  function revealField(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, revealed: true } : f));
  }

  // ── Step 1: Agent connects and requests vault access ──────────────────────

  async function startCheckout() {
    setStep('connecting');
    setLogs([]);
    log('ShadowKey Shopping Agent initializing...');
    await delay(600);
    log('Agent ID: shopping-agent-slice-001');
    log('Purpose: Complete purchase on Slice store');
    await delay(400);
    setStep('requesting');
    log('Requesting scoped vault access via ShadowKey SDK...');
    log('Fields requested: billing_name, shipping_address, card_last4, email');
    await delay(800);
    log('POST /sdk-access-request → requestId: req_demo_slice_001 (HMAC-signed)', 'info');
    await delay(400);
    setPendingApproval(true);
    log('Waiting for vault owner approval...', 'warn');
  }

  // ── Step 2: User approves fields in vault ─────────────────────────────────

  function approveAll() {
    const approved = DEMO_VAULT_FIELDS.map(f => f.key);
    setApprovedFields(approved);
    approved.forEach(k => revealField(k));
    setPendingApproval(false);
    log('Vault owner approved: all 4 fields', 'success');
    continueToERC8128(approved);
  }

  function approvePartial() {
    const approved = ['billing_name', 'shipping_address', 'card_last4'];
    setApprovedFields(approved);
    approved.forEach(k => revealField(k));
    setPendingApproval(false);
    log('Vault owner approved: 3/4 fields (email withheld)', 'success');
    continueToERC8128(approved);
  }

  function denyAccess() {
    setPendingApproval(false);
    log('Vault owner denied access request', 'error');
    setStep('denied');
  }

  // ── Step 3: Agent authenticates checkout with ERC-8128 ───────────────────

  async function continueToERC8128(approved: string[]) {
    setStep('erc8128');
    await delay(300);
    log('Access granted. Building ERC-8128 signed checkout request...');
    await delay(500);

    // Simulate ERC-8128 header generation
    const created = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(16).slice(2, 10);
    const agentAddress = '0x1111111111111111111111111111111111111111';
    const sigInput = `sig1=("@method" "@path" "@authority" "content-digest");created=${created};nonce="${nonce}";keyid="${agentAddress}"`;
    const contentDigest = 'sha-256=:rRoXGudblFmP3rmVB1BVmhm7kDR9gWvxzDQ7pXWCFE8=:';
    const sig = 'sig1=:MEQCIBZHjzNz9…(truncated)…eQ==:';

    const headers = {
      'Content-Digest': contentDigest,
      'Signature-Input': sigInput,
      'Signature': sig,
      'X-Agent-Address': agentAddress,
    };

    setErc8128Headers(headers);

    log('Content-Digest: ' + contentDigest, 'info');
    log('Signature-Input: ' + sigInput.slice(0, 60) + '...', 'info');
    log('Signature: sig1=:MEQCIBZHjzNz9…(truncated)', 'info');
    log('X-Agent-Address: ' + agentAddress, 'info');
    await delay(600);
    log('ERC-8128 headers attached. Agent identity verified without API key.', 'success');
    await delay(300);
    log(`Checking SliceShadowKeyGate.isPurchaseAllowed(buyer=${agentAddress})...`);
    await delay(500);
    log('Gate contract: buyer trust score = 85 → TRUSTED ✓', 'success');
    await delay(200);
    setStep('checkout');
    await delay(300);
    log(`Submitting order to Slice store with ${approved.length} vault fields...`);
  }

  // ── Step 4: Complete checkout ─────────────────────────────────────────────

  async function completeCheckout() {
    setStep('done');
    await delay(400);
    log('Slice checkout API: 200 OK', 'success');
    await delay(300);
    const txHash = '0xabc' + Math.random().toString(16).slice(2, 12) + '...';
    const receiptId = 'rcpt_' + Math.random().toString(36).slice(2, 10);
    setOrderReceipt({ txHash, receiptId });
    log(`SliceShadowKeyGate.onProductPurchase() emitted PrivacyPreservedPurchase event`, 'success');
    log(`On-chain consent receipt: ${receiptId}`, 'success');
    log('Order complete. Vault data never left ShadowKey — only approved fields shared.', 'success');
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setStep('idle');
    setLogs([]);
    setFields(DEMO_VAULT_FIELDS);
    setApprovedFields([]);
    setPendingApproval(false);
    setErc8128Headers(null);
    setOrderReceipt(null);
  }

  const isRunning = ['connecting', 'requesting', 'erc8128', 'checkout'].includes(step);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <ShoppingCart className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">ShadowKey × Slice</h1>
            <p className="text-gray-400 mt-1">Privacy-Preserving AI Agent Checkout</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                Future of Commerce
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                Slice Hooks
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ERC-8128 Auth
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Synthesis Hackathon
              </span>
            </div>
          </div>
        </div>

        {/* Concept banner */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white">How it works</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div className="flex flex-col gap-1">
              <span className="text-white font-medium">1. Scoped Vault Access</span>
              <span>AI agent requests only the checkout fields it needs. You approve per-field — card number stays hidden, shipping address is revealed.</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-white font-medium">2. ERC-8128 Agent Auth</span>
              <span>Agent signs the checkout request with its Ethereum key (RFC 9421). No API keys, no sessions — every request is independently verifiable.</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-white font-medium">3. Slice Hook Trust Gate</span>
              <span>SliceShadowKeyGate.sol checks buyer trust score before allowing the purchase. Untrusted agents are blocked at the contract level.</span>
            </div>
          </div>
        </div>

        {/* Main demo split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: Product + Agent panel */}
          <div className="space-y-4">

            {/* Product card */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-bold text-white">{PRODUCT.name}</h2>
                  <p className="text-sm text-gray-400 mt-1">{PRODUCT.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">{PRODUCT.price}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Slice Store</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400">Trust-gated via SliceShadowKeyGate</span>
                <a
                  href={`https://sepolia.basescan.org/address/${SLICE_GATE_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                >
                  <ExternalLink className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                </a>
              </div>
            </div>

            {/* Agent control */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-violet-400" />
                <span className="font-semibold text-white">ShadowKey Shopping Agent</span>
                <span className="ml-auto px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Trust Score: 85 ✓
                </span>
              </div>

              {step === 'idle' && (
                <button
                  onClick={startCheckout}
                  className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Start Agent Checkout
                </button>
              )}

              {isRunning && (
                <div className="text-sm text-violet-400 animate-pulse flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Agent running...
                </div>
              )}

              {step === 'denied' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <XCircle className="w-4 h-4" />
                    Access denied — agent cannot proceed without vault data.
                  </div>
                  <button onClick={reset} className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
                    Reset Demo
                  </button>
                </div>
              )}

              {step === 'checkout' && (
                <button
                  onClick={completeCheckout}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Checkout via Slice
                </button>
              )}

              {step === 'done' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Order complete!
                  </div>
                  {orderReceipt && (
                    <div className="text-xs font-mono text-gray-500 space-y-1">
                      <div>Receipt: {orderReceipt.receiptId}</div>
                      <div>On-chain consent proof emitted ✓</div>
                    </div>
                  )}
                  <button onClick={reset} className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
                    Reset Demo
                  </button>
                </div>
              )}

              {/* ERC-8128 headers preview */}
              {erc8128Headers && (
                <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-400">ERC-8128 Headers</span>
                  </div>
                  {Object.entries(erc8128Headers).map(([k, v]) => (
                    <div key={k} className="text-xs font-mono">
                      <span className="text-gray-500">{k}: </span>
                      <span className="text-gray-300 break-all">{v.length > 50 ? v.slice(0, 50) + '...' : v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Vault owner approval panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-white">Your ShadowKey Vault</span>
                {pendingApproval && (
                  <span className="ml-auto px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                    Approval Needed
                  </span>
                )}
              </div>

              {/* Vault fields */}
              <div className="space-y-2 mb-4">
                {fields.map((f) => {
                  const isApproved = approvedFields.includes(f.key);
                  return (
                    <div
                      key={f.key}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-sm
                        ${isApproved
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-gray-700 bg-gray-800/50'}`}
                    >
                      <span className={isApproved ? 'text-emerald-300' : 'text-gray-400'}>{f.label}</span>
                      <span className="font-mono text-xs">
                        {f.revealed ? (
                          <span className="text-white">{f.value}</span>
                        ) : (
                          <span className="text-gray-600">••••••••</span>
                        )}
                      </span>
                      {isApproved && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-2 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Approval buttons */}
              {pendingApproval ? (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400 mb-3">
                    Shopping Agent is requesting access to complete your Slice purchase.
                  </p>
                  <button
                    onClick={approveAll}
                    className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve All Fields
                  </button>
                  <button
                    onClick={approvePartial}
                    className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Approve (hide email)
                  </button>
                  <button
                    onClick={denyAccess}
                    className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Deny
                  </button>
                </div>
              ) : step === 'idle' ? (
                <p className="text-xs text-gray-600 text-center">No pending requests</p>
              ) : step !== 'denied' ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">{approvedFields.length} fields approved</span>
                  <span>— remaining encrypted in vault</span>
                </div>
              ) : null}
            </div>

            {/* Hook contract info */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">SliceShadowKeyGate Contract</span>
              </div>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Network</span>
                  <span className="text-white font-mono">Base Sepolia</span>
                </div>
                <div className="flex justify-between">
                  <span>Trust Threshold</span>
                  <span className="text-white font-mono">≥ 70 / 100</span>
                </div>
                <div className="flex justify-between">
                  <span>ShoppingAgent (85)</span>
                  <span className="text-emerald-400">TRUSTED ✓</span>
                </div>
                <div className="flex justify-between">
                  <span>TravelAgent (62)</span>
                  <span className="text-amber-400">BLOCKED ✗</span>
                </div>
                <div className="flex justify-between">
                  <span>ResearchAgent (12)</span>
                  <span className="text-red-400">BLOCKED ✗</span>
                </div>
              </div>
              {SLICE_GATE_ADDRESS !== '0x...SliceShadowKeyGate' && (
                <a
                  href={`https://sepolia.basescan.org/address/${SLICE_GATE_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  View on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Agent log */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">Agent Log</span>
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {logs.map((entry, i) => (
                <LogLine key={i} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* Architecture summary */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-violet-400">ERC-8128</div>
            <div className="text-xs text-gray-500 mt-1">Agent Auth (no API keys)</div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-400">Field-Level</div>
            <div className="text-xs text-gray-500 mt-1">Consent (not all-or-nothing)</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400">On-Chain</div>
            <div className="text-xs text-gray-500 mt-1">Trust Gate (Slice Hook)</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">Receipt</div>
            <div className="text-xs text-gray-500 mt-1">Immutable consent proof</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
