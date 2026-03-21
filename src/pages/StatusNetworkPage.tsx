import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Shield, Zap, CheckCircle, XCircle, AlertTriangle, ExternalLink, Copy, Bot, Activity } from 'lucide-react';
import { getTrustLevel } from '../lib/agentReputation';
import { STATUS_NETWORK_SEPOLIA_CHAIN_ID, STATUS_NETWORK_SEPOLIA_CONFIG, DEMO_AGENT_ADDRESSES } from '../lib/constants';
import AttestationABI from '../lib/ShadowKeyAttestationABI.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_ATTESTATION_CONTRACT_ADDRESS || '';
const STATUS_RPC = 'https://public.sepolia.rpc.status.network';
const EXPLORER = 'https://sepolia.explorer.status.network';

interface AgentDecision {
  name: string;
  address: string;
  score: number;
  decision: 'TRUSTED' | 'CAUTIOUS' | 'BLOCKED';
  txHash?: string;
  attesting?: boolean;
  attested?: boolean;
}

const DEMO_DECISIONS: AgentDecision[] = [
  { name: 'ShoppingAgent', address: DEMO_AGENT_ADDRESSES.shopping, score: 85, decision: 'TRUSTED' },
  { name: 'TravelAgent',   address: DEMO_AGENT_ADDRESSES.travel,   score: 62, decision: 'CAUTIOUS' },
  { name: 'ResearchAgent', address: DEMO_AGENT_ADDRESSES.research,  score: 12, decision: 'BLOCKED' },
];

// Static tx hashes from pre-run gaslessAttest.cjs — replace after running the script
const STATIC_TX_HASHES: Record<string, string> = {
  [DEMO_AGENT_ADDRESSES.shopping]: '0xae1c066cf62a468f7ce626d91bcfa4cec2a30107e0ac26cc55570726c5386db7',
  [DEMO_AGENT_ADDRESSES.travel]:   '0xe46cba7ea79be170ccbf5228a121131bb8b4c4eb5c2ddc589d9d4ee174dfd7f9',
  [DEMO_AGENT_ADDRESSES.research]: '0x964434b7ae6c14c8c28c106a0a588b6a10398b2b28ae9f7e8617681714f3bb0c',
};

function DecisionBadge({ decision }: { decision: AgentDecision['decision'] }) {
  if (decision === 'TRUSTED')  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">TRUSTED</span>;
  if (decision === 'CAUTIOUS') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">CAUTIOUS</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">BLOCKED</span>;
}

function DecisionIcon({ decision }: { decision: AgentDecision['decision'] }) {
  if (decision === 'TRUSTED')  return <CheckCircle className="w-4 h-4 text-emerald-400" />;
  if (decision === 'CAUTIOUS') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

export function StatusNetworkPage() {
  const [connected, setConnected] = useState(false);
  const [onStatusNetwork, setOnStatusNetwork] = useState(false);
  const [running, setRunning] = useState(false);
  const [agents, setAgents] = useState<AgentDecision[]>(
    DEMO_DECISIONS.map(a => ({
      ...a,
      txHash: STATIC_TX_HASHES[a.address] || undefined,
      attested: Boolean(STATIC_TX_HASHES[a.address]),
    }))
  );
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) return;
    try {
      const accounts = await eth.request({ method: 'eth_accounts' }) as string[];
      if (accounts.length > 0) {
        setConnected(true);
        const chainId = await eth.request({ method: 'eth_chainId' }) as string;
        setOnStatusNetwork(parseInt(chainId, 16) === STATUS_NETWORK_SEPOLIA_CHAIN_ID);
      }
    } catch {}
  }

  async function connectStatusNetwork() {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) { alert('MetaMask not found'); return; }
    try {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [STATUS_NETWORK_SEPOLIA_CONFIG],
      });
      await eth.request({ method: 'eth_requestAccounts' });
      setConnected(true);
      setOnStatusNetwork(true);
      log('Connected to Status Network Sepolia');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`Error: ${msg}`);
    }
  }

  function log(msg: string) {
    setAgentLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  }

  async function runReputationAgent() {
    setRunning(true);
    log('ShadowKey Reputation Agent starting...');
    log('Reading agent trust scores from reputation engine...');

    const updatedAgents = [...agents];

    for (let i = 0; i < updatedAgents.length; i++) {
      const agent = updatedAgents[i];
      const level = getTrustLevel(agent.score);
      log(`Evaluating ${agent.name}: score=${agent.score} → ${level.label}`);

      updatedAgents[i] = { ...agent, attesting: true };
      setAgents([...updatedAgents]);

      if (onStatusNetwork && CONTRACT_ADDRESS) {
        try {
          const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
          if (!eth) throw new Error('No wallet');
          const provider = new ethers.BrowserProvider(eth as Parameters<typeof ethers.BrowserProvider>[0]);
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(CONTRACT_ADDRESS, AttestationABI, signer);

          log(`Sending gasless attest() for ${agent.name} (gasPrice=0)...`);
          const tx = await contract.attest(agent.address, agent.score, {
            gasPrice: BigInt(0),
            gasLimit: BigInt(200000),
          });
          log(`TX submitted: ${tx.hash.slice(0, 18)}...`);
          await tx.wait();
          log(`Confirmed on Status Network! Explorer: ${EXPLORER}/tx/${tx.hash}`);

          updatedAgents[i] = { ...updatedAgents[i], txHash: tx.hash, attesting: false, attested: true };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          log(`Error attesting ${agent.name}: ${msg}`);
          updatedAgents[i] = { ...updatedAgents[i], attesting: false };
        }
      } else {
        // Simulated mode: show decision without live tx
        await new Promise(r => setTimeout(r, 800));
        log(`[Simulated] Agent decision recorded for ${agent.name}`);
        updatedAgents[i] = { ...updatedAgents[i], attesting: false, attested: Boolean(agent.txHash) };
      }

      setAgents([...updatedAgents]);
    }

    log('Reputation agent run complete.');
    setRunning(false);
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const readProvider = new ethers.JsonRpcProvider(STATUS_RPC);
  void readProvider; // used for future event loading

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Zap className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">ShadowKey × Status Network</h1>
            <p className="text-gray-400 mt-1">Gasless AI Agent Attestations</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                Chain ID: 1660990954
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                gasPrice = 0
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Synthesis Hackathon
              </span>
            </div>
          </div>
        </div>

        {/* Explainer */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">How the AI Agent Works</span>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            The ShadowKey reputation engine reads agent trust scores computed from disclosure history
            (approved requests, budget violations, denied requests). Agents scoring ≥70 are "Trusted".
            This page runs the reputation agent autonomously — it evaluates each agent and attests
            trusted ones on-chain via <span className="text-cyan-400 font-mono">gasPrice=0</span> transactions
            on Status Network Sepolia. No human approves individual attestations.
          </p>
        </div>

        {/* Connect button */}
        {!onStatusNetwork && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Connect to Status Network Sepolia</p>
              <p className="text-sm text-gray-400 mt-0.5">Required to submit live gasless transactions</p>
            </div>
            <button
              onClick={connectStatusNetwork}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm transition-colors"
            >
              {connected ? 'Switch Network' : 'Connect Wallet'}
            </button>
          </div>
        )}

        {onStatusNetwork && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">Connected to Status Network Sepolia — gasless transactions enabled</span>
          </div>
        )}

        {/* Agent Decision Table */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span className="font-semibold text-white">Agent Trust Decisions</span>
            </div>
            <button
              onClick={runReputationAgent}
              disabled={running}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <Activity className={`w-4 h-4 ${running ? 'animate-pulse' : ''}`} />
              {running ? 'Running Agent...' : 'Run AI Reputation Agent'}
            </button>
          </div>

          <div className="divide-y divide-gray-800">
            {agents.map((agent) => (
              <div key={agent.address} className="p-4 flex items-center gap-4">
                <DecisionIcon decision={agent.decision} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{agent.name}</span>
                    <DecisionBadge decision={agent.decision} />
                    {agent.attesting && (
                      <span className="text-xs text-cyan-400 animate-pulse">attesting...</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{agent.address}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{agent.score}</div>
                  <div className="text-xs text-gray-500">trust score</div>
                </div>
                <div className="w-48 text-right">
                  {agent.txHash ? (
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={`${EXPLORER}/tx/${agent.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                      >
                        {agent.txHash.slice(0, 10)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => copyToClipboard(agent.txHash!, agent.txHash!)}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {copied === agent.txHash && (
                        <span className="text-xs text-emerald-400">Copied!</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">
                      {onStatusNetwork && CONTRACT_ADDRESS ? 'pending agent run' : 'run agent to attest'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Log */}
        {agentLog.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Agent Log</span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {agentLog.map((entry, i) => (
                <div key={i} className="text-xs font-mono text-gray-400">{entry}</div>
              ))}
            </div>
          </div>
        )}

        {/* Contract info */}
        {CONTRACT_ADDRESS && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="text-sm font-semibold text-white mb-2">Contract on Status Network Sepolia</div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 break-all">{CONTRACT_ADDRESS}</span>
              <a
                href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <ExternalLink className="w-4 h-4 text-cyan-400 hover:text-cyan-300" />
              </a>
            </div>
          </div>
        )}

        {/* Gasless explanation */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">0</div>
            <div className="text-xs text-gray-500 mt-1">Gas Price (wei)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">$0.00</div>
            <div className="text-xs text-gray-500 mt-1">Transaction Cost</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400 font-mono">L2</div>
            <div className="text-xs text-gray-500 mt-1">Status Network (zkEVM)</div>
          </div>
        </div>

      </div>
    </div>
  );
}
