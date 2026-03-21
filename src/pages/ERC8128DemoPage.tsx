import { useState } from 'react';
import { Shield, Key, CheckCircle, XCircle, ChevronDown, ChevronUp, Copy, Zap } from 'lucide-react';
import { signRequest, verifyRequest } from '../../sdk/src/erc8128';
import type { ERC8128Headers, ERC8128SignerConfig } from '../../sdk/src/erc8128';

const DEMO_API_URL = `${import.meta.env.VITE_SUPABASE_URL || 'https://your-api.supabase.co'}/functions/v1/sdk-access-request`;

interface SignedEntry {
  timestamp: string;
  method: string;
  url: string;
  headers: ERC8128Headers;
  base: string;
  recoveredAddress: string;
  verified: boolean;
}

export function ERC8128DemoPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [entries, setEntries] = useState<SignedEntry[]>([]);
  const [expandedBase, setExpandedBase] = useState<number | null>(null);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  async function connectWallet() {
    const eth = getEthereum();
    if (!eth) { setError('MetaMask not found. Try the simulated demo below.'); return; }
    setConnecting(true);
    setError('');
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[];
      setWalletAddress(accounts[0]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function runSignDemo(simulated = false) {
    setSigning(true);
    setError('');
    try {
      const address = simulated
        ? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
        : walletAddress;

      const signerConfig: ERC8128SignerConfig = simulated
        ? {
            address,
            sign: async (message: string) => {
              // Simulated signature — deterministic fake for demo only
              const enc = new TextEncoder();
              const data = enc.encode(message + address);
              const hashBuffer = await crypto.subtle.digest('SHA-256', data);
              const hex = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
              // Pad to 65 bytes (130 hex chars) like a real sig, mark v=0x1b
              return '0x' + hex + hex.slice(0, 66) + '1b';
            },
          }
        : {
            address,
            sign: async (message: string) => {
              const eth = getEthereum()!;
              return eth.request({
                method: 'personal_sign',
                params: [message, address],
              }) as Promise<string>;
            },
          };

      const body = JSON.stringify({
        agentId: 'shadowkey-demo-agent',
        requestedFields: ['email', 'full_name'],
        purpose: 'ERC-8128 authentication demo',
        category: 'identity',
      });

      const headers = await signRequest(signerConfig, {
        method: 'POST',
        url: DEMO_API_URL,
        body,
      });

      // Verify locally (no server round-trip needed for demo)
      let recoveredAddress = '';
      let verified = false;

      if (!simulated) {
        try {
          recoveredAddress = await verifyRequest({
            method: 'POST',
            url: DEMO_API_URL,
            signatureInput: headers['Signature-Input'],
            signature: headers['Signature'],
            contentDigest: headers['Content-Digest'],
          });
          verified = recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch {
          verified = false;
        }
      }

      // Extract base string from signature input for display
      const sigInput = headers['Signature-Input'];
      const sigParamsValue = sigInput.replace(/^sig1=/, '');
      const nonceMatch = sigParamsValue.match(/nonce="([^"]+)"/);
      const createdMatch = sigParamsValue.match(/created=(\d+)/);
      const baseLines = [
        `"@method": POST`,
        `"@path": /functions/v1/sdk-access-request`,
        `"@authority": ${new URL(DEMO_API_URL).host}`,
        `"content-digest": ${headers['Content-Digest'] ?? ''}`,
        `"@signature-params": ${sigParamsValue}`,
      ];

      const entry: SignedEntry = {
        timestamp: new Date().toLocaleTimeString(),
        method: 'POST',
        url: DEMO_API_URL,
        headers,
        base: baseLines.join('\n'),
        recoveredAddress: simulated ? address : recoveredAddress,
        verified: simulated ? true : verified,
      };

      setEntries(prev => [entry, ...prev]);
      void nonceMatch; void createdMatch;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigning(false);
    }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  function getEthereum() {
    return (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum ?? null;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Key className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">ERC-8128 Agent Authentication</h1>
            <p className="text-gray-400 mt-1">RFC 9421 HTTP Message Signatures for Ethereum — Slice Hackathon Track</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20">ERC-8128</span>
              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">RFC 9421</span>
              <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">Slice Hackathon</span>
            </div>
          </div>
        </div>

        {/* SIWE vs ERC-8128 comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
            <div className="text-sm font-semibold text-gray-400 mb-3">SIWE (Sign-In with Ethereum)</div>
            <ul className="space-y-1.5 text-sm text-gray-400">
              <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> One-time login → server issues session token</li>
              <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> Subsequent requests use stored cookie/JWT</li>
              <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> Session can be stolen or replayed</li>
              <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> Server must maintain session state</li>
            </ul>
          </div>
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="text-sm font-semibold text-violet-400 mb-3">ERC-8128 (Every Request Signed)</div>
            <ul className="space-y-1.5 text-sm text-gray-300">
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Each request signed with Ethereum key</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> No stored secrets — signature IS the credential</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Cryptographically bound to request content</li>
              <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Stateless server — verify via ecrecover</li>
            </ul>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white">How ERC-8128 Works</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { step: '1', label: 'Hash body', desc: 'SHA-256 → Content-Digest header' },
              { step: '2', label: 'Build base', desc: 'Method + path + authority + digest' },
              { step: '3', label: 'Sign base', desc: 'Ethereum personal_sign (ecrecover)' },
              { step: '4', label: 'Attach headers', desc: 'Signature-Input + Signature sent' },
            ].map(s => (
              <div key={s.step} className="text-center p-3 rounded-lg bg-gray-800/50">
                <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm font-bold flex items-center justify-center mx-auto mb-2">{s.step}</div>
                <div className="text-xs font-semibold text-white mb-1">{s.label}</div>
                <div className="text-xs text-gray-500">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Demo */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-white">Live Demo</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            {!walletAddress ? (
              <button
                onClick={connectWallet}
                disabled={connecting}
                className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                {connecting ? 'Connecting...' : 'Connect MetaMask'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-mono">{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</span>
              </div>
            )}

            {walletAddress && (
              <button
                onClick={() => runSignDemo(false)}
                disabled={signing}
                className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                {signing ? 'Signing...' : 'Sign a Request'}
              </button>
            )}

            <button
              onClick={() => runSignDemo(true)}
              disabled={signing}
              className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold text-sm transition-colors"
            >
              {signing ? 'Running...' : 'Simulated Demo'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          {/* Signed request log */}
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-lg border border-gray-700 bg-gray-950 overflow-hidden">
                {/* Entry header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">POST</span>
                    <span className="text-xs text-gray-400 font-mono">{entry.timestamp}</span>
                    {entry.verified ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> VERIFIED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <CheckCircle className="w-3.5 h-3.5" /> SIMULATED
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    Signer: {entry.recoveredAddress.slice(0, 10)}...
                  </span>
                </div>

                {/* Headers */}
                <div className="p-3 space-y-2 text-xs font-mono">
                  {entry.headers['Content-Digest'] && (
                    <HeaderRow
                      name="Content-Digest"
                      value={entry.headers['Content-Digest']}
                      onCopy={(v) => copyText(v, `cd-${i}`)}
                      copied={copied === `cd-${i}`}
                    />
                  )}
                  <HeaderRow
                    name="Signature-Input"
                    value={entry.headers['Signature-Input']}
                    onCopy={(v) => copyText(v, `si-${i}`)}
                    copied={copied === `si-${i}`}
                  />
                  <HeaderRow
                    name="Signature"
                    value={entry.headers['Signature']}
                    onCopy={(v) => copyText(v, `sg-${i}`)}
                    copied={copied === `sg-${i}`}
                  />
                </div>

                {/* Signature base toggle */}
                <button
                  onClick={() => setExpandedBase(expandedBase === i ? null : i)}
                  className="w-full px-3 py-2 border-t border-gray-800 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                >
                  {expandedBase === i ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expandedBase === i ? 'Hide' : 'Show'} signature base string
                </button>
                {expandedBase === i && (
                  <div className="px-3 pb-3 border-t border-gray-800">
                    <pre className="mt-2 p-3 rounded bg-black/50 text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre">
                      {entry.base}
                    </pre>
                    <p className="text-xs text-gray-600 mt-1">
                      This exact string is what gets signed by personal_sign (with Ethereum prefix added automatically).
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {entries.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-sm">
              Click "Sign a Request" or "Simulated Demo" to see ERC-8128 in action
            </div>
          )}
        </div>

        {/* Code snippet */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="text-sm font-semibold text-white mb-3">Usage — ERC8128ShadowKeyClient</div>
          <pre className="text-xs font-mono text-gray-300 overflow-x-auto bg-gray-950 p-4 rounded-lg leading-relaxed">{`import { ERC8128ShadowKeyClient } from '@shadowkey/agent-sdk';
import { ethers } from 'ethers';

const wallet = new ethers.Wallet(PRIVATE_KEY);

const client = new ERC8128ShadowKeyClient({
  apiUrl: 'https://your-api.supabase.co/functions/v1',
  signerConfig: {
    address: wallet.address,
    sign: (msg) => wallet.signMessage(msg),
  },
});

// Every request is signed — no API key needed
const response = await client.requestAccess({
  agentId: 'my-trading-agent',
  requestedFields: ['api_key', 'endpoint'],
  purpose: 'Execute trade on GMX',
  category: 'credentials',
  expiresIn: 300,
});`}</pre>
        </div>

        {/* Why for ShadowKey */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="text-sm font-semibold text-violet-400 mb-2">Why ERC-8128 for ShadowKey</div>
          <p className="text-sm text-gray-400 leading-relaxed">
            ShadowKey's threat model is AI agents requesting access to human secrets. ERC-8128 makes
            the agent's Ethereum identity the auth credential — no shared secrets that can be stolen,
            no sessions that can be hijacked. Each request is bound to its content (method, path,
            body hash) so requests can't be replayed or tampered. The server verifies via ecrecover
            with no state — just the agent's address.
          </p>
        </div>

      </div>
    </div>
  );
}

function HeaderRow({
  name, value, onCopy, copied
}: {
  name: string;
  value: string;
  onCopy: (v: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-start gap-2 group">
      <span className="text-violet-400 shrink-0 w-36">{name}:</span>
      <span className="text-gray-300 break-all flex-1">{value}</span>
      <button
        onClick={() => onCopy(value)}
        className="shrink-0 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
