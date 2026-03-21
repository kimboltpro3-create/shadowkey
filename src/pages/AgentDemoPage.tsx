import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, ShieldCheck, Send, CheckCircle, XCircle, Eye, EyeOff,
  Zap, Clock, ArrowRight, Loader2, Sparkles, Lock, AlertTriangle, ExternalLink, ChevronLeft,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { CATEGORY_FIELDS } from '../lib/constants';
import {
  registerSchema,
  createDisclosureAttestation,
  isEASAvailable,
  getEASScanUrl,
  storePublicAttestation,
  getAttestationBasescanUrl,
} from '../lib/eas';
import { pinDisclosureToIPFS } from '../lib/ipfs';
import { startChainFallbackWatcher } from '../lib/chainFallback';
import type { ChainWatcherHandle } from '../lib/chainFallback';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types ──────────────────────────────────────────────────
type Step = 'idle' | 'thinking' | 'requesting' | 'waiting' | 'approved' | 'denied' | 'completing' | 'done' | 'error';

interface LogEntry {
  time: string;
  source: 'agent' | 'sdk' | 'vault' | 'system';
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface Scenario {
  id: string;
  name: string;
  icon: string;
  agentName: string;
  purpose: string;
  category: string;
  requestedFields: string[];
  systemPrompt: string;
  completionPrompt: (fields: Record<string, string>) => string;
}

// ─── Scenarios ──────────────────────────────────────────────
const SCENARIOS: Scenario[] = [
  {
    id: 'shopping',
    name: 'Shopping Agent',
    icon: '🛒',
    agentName: 'ShopBot Pro',
    purpose: 'Complete a $49.99 purchase for wireless earbuds on Amazon',
    category: 'payment',
    requestedFields: ['card_number', 'expiry', 'billing_name', 'billing_address', 'shipping_address'],
    systemPrompt: `You are ShopBot Pro, an AI shopping agent. The user wants to buy wireless earbuds ($49.99) on Amazon. You need to determine what data fields from the user's privacy vault you'll need. Analyze and respond with ONLY a JSON object (no markdown, no backticks) like: {"needed_fields":["field1","field2"],"reasoning":"brief explanation of why each field is needed"}. Available fields: card_number, expiry, cvv, billing_name, billing_address, shipping_address.`,
    completionPrompt: (fields) => `You are ShopBot Pro. You just received approved data from the user's ShadowKey vault. The fields you received: ${JSON.stringify(fields)}. Write a short 2-3 sentence confirmation of the purchase. Mention which fields you used and which were protected. Keep it conversational.`,
  },
  {
    id: 'travel',
    name: 'Travel Booking Agent',
    icon: '✈️',
    agentName: 'TravelAI',
    purpose: 'Book a round-trip flight NYC → Tokyo and reserve hotel for 5 nights',
    category: 'identity',
    requestedFields: ['full_name', 'email', 'phone', 'dob', 'passport_number', 'passport_country'],
    systemPrompt: `You are TravelAI, an AI travel booking agent. The user wants to book a round-trip flight from NYC to Tokyo and a hotel for 5 nights. You need to determine what identity fields from the user's privacy vault you'll need. Analyze and respond with ONLY a JSON object (no markdown, no backticks) like: {"needed_fields":["field1","field2"],"reasoning":"brief explanation of why each field is needed"}. Available fields: full_name, email, phone, dob, passport_number, passport_country, nationality.`,
    completionPrompt: (fields) => `You are TravelAI. You just received approved data from the user's ShadowKey vault. The fields you received: ${JSON.stringify(fields)}. Write a short 2-3 sentence confirmation of the travel booking. Mention which specific fields you used and note that sensitive fields like passport number were protected. Keep it conversational.`,
  },
  {
    id: 'health',
    name: 'Health Assistant',
    icon: '🏥',
    agentName: 'MedAssist AI',
    purpose: 'Pre-fill emergency room intake form and check drug interactions',
    category: 'health',
    requestedFields: ['blood_type', 'allergies', 'medications', 'conditions', 'emergency_contact'],
    systemPrompt: `You are MedAssist AI, an AI health assistant. The user needs to pre-fill an emergency room intake form and check for drug interactions. You need health data from the user's privacy vault. Analyze and respond with ONLY a JSON object (no markdown, no backticks) like: {"needed_fields":["field1","field2"],"reasoning":"brief explanation of why each field is needed"}. Available fields: blood_type, allergies, medications, conditions, emergency_contact.`,
    completionPrompt: (fields) => `You are MedAssist AI. You just received approved health data from the user's ShadowKey vault. The fields you received: ${JSON.stringify(fields)}. Write a short 2-3 sentence response about pre-filling the ER intake form. Mention which fields were shared and which were withheld for privacy. Keep it brief and professional.`,
  },
];

// ─── Free OpenRouter Models ─────────────────────────────────
const FREE_MODELS = [
  'nvidia/llama-3.3-nemotron-super-49b-v1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'stepfun/step-3.5-flash:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── OpenRouter API Call ────────────────────────────────────
async function callOpenRouter(apiKey: string, prompt: string, systemPrompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < FREE_MODELS.length; i++) {
    const model = FREE_MODELS[i];
    // Wait between retries to avoid 429 rate limits
    if (i > 0) await delay(2000);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ShadowKey Agent Demo',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      // On rate limit, wait and retry with next model
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 3000;
        await delay(Math.min(waitMs, 5000));
        throw new Error(`Rate limited on ${model.split('/')[1]}`);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response');
      return content;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Try next model
      if (i < FREE_MODELS.length - 1) continue;
    }
  }

  throw lastError || new Error('All 4 models failed');
}

// ─── Simulated AI Response (fallback) ───────────────────────
function simulateAIThinking(scenario: Scenario): { needed_fields: string[]; reasoning: string } {
  return {
    needed_fields: scenario.requestedFields,
    reasoning: `To ${scenario.purpose.toLowerCase()}, I need these specific fields. Each serves a critical function in completing the transaction securely.`,
  };
}

function simulateAICompletion(scenario: Scenario, approvedFields: string[]): string {
  const denied = scenario.requestedFields.filter((f) => !approvedFields.includes(f));
  return `${scenario.purpose} — processing complete! I used ${approvedFields.length} approved field(s): ${approvedFields.join(', ')}. ${denied.length > 0 ? `${denied.join(', ')} remained protected in your vault — your privacy is preserved.` : 'All requested fields were provided.'}`;
}

// ─── Receipt generator — uses actual approved vault values ───
function generateReceipt(scenarioId: string, scopedData: Record<string, string>): Record<string, string> {
  const ref = Math.random().toString(36).substr(2, 5).toUpperCase();
  if (scenarioId === 'shopping') {
    const lastFour = scopedData.card_number
      ? scopedData.card_number.replace(/\s/g, '').slice(-4)
      : '7891';
    return {
      'Order': `#SK-${ref}`,
      'Item': 'Sony WF-1000XM5 Wireless Earbuds',
      'Charged': `$49.99 → Visa ••••${lastFour} (exp ${scopedData.expiry || '09/27'})`,
      'Ship to': scopedData.shipping_address || scopedData.billing_address || 'Address on file',
      'Email': 'alex.j@proton.me',
      'ETA': 'April 15, 2026',
      'Status': '✅ Order confirmed',
    };
  } else if (scenarioId === 'travel') {
    return {
      'Booking ref': `TKT-${ref}`,
      'Passenger': scopedData.full_name || 'Alex Johnson',
      'Route': 'JFK → NRT (round-trip)',
      'Dates': 'Apr 15–22, 2026',
      'Passport': scopedData.passport_number || 'On file',
      'Hotel': 'Shinjuku Grand, 5 nights',
      'Total': '$2,847.50',
      'Status': '✅ Booking confirmed',
    };
  } else {
    return {
      'Form ID': `ER-${ref}`,
      'Patient': 'Alex Johnson',
      'Blood type': scopedData.blood_type || 'On file',
      'Allergies': scopedData.allergies || 'None listed',
      'Medications': scopedData.medications || 'None listed',
      'Conditions': scopedData.conditions || 'None listed',
      'Emergency contact': scopedData.emergency_contact || 'Not provided',
      'Status': '✅ Intake form pre-filled',
    };
  }
}

// ─── Demo sample vault data ─────────────────────────────────
const SAMPLE_VAULT_DATA: Record<string, Record<string, string>> = {
  payment: {
    card_number: '4532 •••• •••• 7891',
    expiry: '09/27',
    cvv: '•••',
    billing_name: 'Alex Johnson',
    billing_address: '742 Evergreen Terrace, Springfield, IL 62704',
    shipping_address: '742 Evergreen Terrace, Springfield, IL 62704',
  },
  identity: {
    full_name: 'Alex Johnson',
    email: 'alex.j@proton.me',
    phone: '+1 (555) 012-3456',
    dob: '1992-03-15',
    passport_number: 'P•••••••89',
    passport_country: 'US',
    nationality: 'American',
  },
  health: {
    blood_type: 'O+',
    allergies: 'Penicillin, Shellfish',
    medications: 'Lisinopril 10mg daily',
    conditions: 'Mild asthma',
    emergency_contact: 'Sarah Johnson — +1 (555) 987-6543',
  },
};

// ─── Component ──────────────────────────────────────────────
export function AgentDemoPage() {
  const navigate = useNavigate();
  const { vaultId } = useApp();

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openrouter_key') || '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');
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [step, setStep] = useState<Step>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aiThinking, setAiThinking] = useState('');
  const [aiCompletion, setAiCompletion] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestedFields, setRequestedFields] = useState<string[]>([]);
  const [approvedFields, setApprovedFields] = useState<string[]>([]);
  const [deniedFields, setDeniedFields] = useState<string[]>([]);
  const [scopedData, setScopedData] = useState<Record<string, string>>({});
  const [elapsedMs, setElapsedMs] = useState(0);
  const [useRealAI, setUseRealAI] = useState(true);
  const [attestationUID, setAttestationUID] = useState<string | null>(null);
  const [attestationTxHash, setAttestationTxHash] = useState<string | null>(null);
  const [attestationChainId, setAttestationChainId] = useState<number>(8453);
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [receipt, setReceipt] = useState<Record<string, string> | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);

  const [chainBlock, setChainBlock] = useState<number | null>(null);
  const [chainFallbackActive, setChainFallbackActive] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const chainWatcherRef = useRef<ChainWatcherHandle | null>(null);

  // Auto-save API key
  useEffect(() => {
    if (apiKey) localStorage.setItem('openrouter_key', apiKey);
  }, [apiKey]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = useCallback((source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), source, message, type }]);
  }, []);

  // On-chain fallback watcher — activates when waiting for approval
  useEffect(() => {
    const contractAddress = import.meta.env.VITE_SHADOW_VAULT_ADDRESS as string;
    if (step === 'waiting' && contractAddress) {
      setChainFallbackActive(true);
      addLog('system', '🔗 On-chain fallback: monitoring Base Mainnet directly...', 'info');
      addLog('system', 'If Supabase is unavailable, EAS + contract events confirm approval', 'info');

      chainWatcherRef.current = startChainFallbackWatcher(
        contractAddress,
        (event) => {
          if (event.type === 'eas_attestation') {
            addLog('system', `⛓️ EAS Attested on-chain: UID ${event.data.uid}`, 'success');
          } else if (event.type === 'vault_disclosure') {
            addLog('system', `⛓️ DisclosureLogged on-chain: policy ${event.data.policyId}`, 'success');
          }
        },
        (blockNumber) => {
          setChainBlock(blockNumber);
        },
      );
    } else {
      if (chainWatcherRef.current) {
        chainWatcherRef.current.stop();
        chainWatcherRef.current = null;
      }
      setChainFallbackActive(false);
      setChainBlock(null);
    }

    return () => {
      if (chainWatcherRef.current) {
        chainWatcherRef.current.stop();
        chainWatcherRef.current = null;
      }
    };
  }, [step, addLog]);

  const startTimer = useCallback(() => {
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs((p) => p + 100), 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ─── Main Flow ──────────────────────────────────────────
  const runDemo = useCallback(async () => {
    setLogs([]);
    setAiThinking('');
    setAiCompletion('');
    setRequestId(null);
    setRequestedFields([]);
    setApprovedFields([]);
    setDeniedFields([]);
    setScopedData({});
    setReceipt(null);
    setReceiptLoading(false);
    setIpfsCid(null);
    setAttestationUID(null);
    setAttestationTxHash(null);
    setAttestationLoading(false);
    startTimer();

    // ── Step 1: AI Thinking ─────────────────────────────
    setStep('thinking');
    addLog('agent', `${scenario.agentName} initializing...`);
    addLog('agent', `Task: ${scenario.purpose}`);
    addLog('agent', 'Analyzing what user data I need...');

    let neededFields: string[] = [];
    let reasoning = '';

    try {
      if (useRealAI && apiKey) {
        addLog('agent', 'Calling OpenRouter AI (free model with failover)...');
        const raw = await callOpenRouter(apiKey, scenario.purpose, scenario.systemPrompt);
        addLog('agent', 'AI response received', 'success');

        try {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);
          neededFields = parsed.needed_fields || scenario.requestedFields;
          reasoning = parsed.reasoning || '';
        } catch {
          neededFields = scenario.requestedFields;
          reasoning = raw.slice(0, 200);
        }
      } else {
        addLog('agent', 'Using simulated AI (no API key provided)');
        await new Promise((r) => setTimeout(r, 1200));
        const sim = simulateAIThinking(scenario);
        neededFields = sim.needed_fields;
        reasoning = sim.reasoning;
      }
    } catch (err) {
      addLog('agent', `OpenRouter failed: ${err instanceof Error ? err.message : 'Unknown'} — using fallback`, 'warning');
      await new Promise((r) => setTimeout(r, 500));
      const sim = simulateAIThinking(scenario);
      neededFields = sim.needed_fields;
      reasoning = sim.reasoning;
    }

    // Filter to only valid fields for the category
    const validFields = CATEGORY_FIELDS[scenario.category as keyof typeof CATEGORY_FIELDS] || [];
    neededFields = neededFields.filter((f) => validFields.includes(f));
    if (neededFields.length === 0) neededFields = scenario.requestedFields;

    setAiThinking(reasoning);
    setRequestedFields(neededFields);
    addLog('agent', `Need ${neededFields.length} fields: ${neededFields.join(', ')}`);

    await new Promise((r) => setTimeout(r, 600));

    // ── Step 2: SDK Access Request ──────────────────────
    setStep('requesting');
    addLog('sdk', 'Creating SDK access request...');
    addLog('sdk', `POST /functions/v1/sdk-access-request`);

    const reqId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 300_000).toISOString();

    // Write pending disclosure log to Supabase (simulates what SDK edge function does)
    if (vaultId) {
      try {
        await supabase.from('disclosure_logs').insert({
          id: reqId,
          vault_id: vaultId,
          service_id: `agent-${scenario.id}`,
          service_name: scenario.agentName,
          fields_requested: neededFields,
          purpose: scenario.purpose,
          category: scenario.category,
          status: 'pending',
          expires_at: expiresAt,
          metadata: { sdk_request: true, demo: true },
        });
        addLog('sdk', `Request created: ${reqId.slice(0, 8)}...`, 'success');
      } catch {
        addLog('sdk', 'Supabase insert skipped (demo mode)', 'warning');
      }
    } else {
      addLog('sdk', `Request created (local): ${reqId.slice(0, 8)}...`, 'success');
    }

    setRequestId(reqId);
    addLog('sdk', `Status: pending | Expires: ${new Date(expiresAt).toLocaleTimeString()}`);

    // ── Step 3: Waiting for approval ────────────────────
    setStep('waiting');
    addLog('sdk', 'Polling for user approval...');
    addLog('vault', '🔔 New access request from ' + scenario.agentName, 'warning');
  }, [scenario, apiKey, useRealAI, vaultId, addLog, startTimer]);

  // ─── Approve Handler ─────────────────────────────────
  const handleApprove = useCallback(async (selectedFields: string[]) => {
    const denied = requestedFields.filter((f) => !selectedFields.includes(f));
    setApprovedFields(selectedFields);
    setDeniedFields(denied);

    addLog('vault', `Approved ${selectedFields.length} fields: ${selectedFields.join(', ')}`, 'success');
    if (denied.length > 0) {
      addLog('vault', `Denied ${denied.length} fields: ${denied.join(', ')}`, 'warning');
    }

    // Update Supabase record
    if (vaultId && requestId) {
      try {
        await supabase.from('disclosure_logs').update({
          status: 'approved',
          fields_disclosed: selectedFields,
          approved_at: new Date().toISOString(),
        }).eq('id', requestId);
      } catch { /* demo mode */ }
    }

    setStep('approved');
    addLog('sdk', 'Status changed: pending → approved');

    // Build scoped data (only approved fields)
    const categoryData = SAMPLE_VAULT_DATA[scenario.category] || {};
    const scoped: Record<string, string> = {};
    for (const f of selectedFields) {
      scoped[f] = categoryData[f] || `[${f}]`;
    }
    setScopedData(scoped);

    addLog('sdk', `Releasing ${selectedFields.length} scoped field(s) to agent...`);
    await new Promise((r) => setTimeout(r, 800));
    addLog('agent', `Received scoped data (${selectedFields.length} fields)`, 'success');

    // ── Step 5: AI Completion ─────────────────────────
    setStep('completing');
    addLog('agent', 'Processing received data...');

    let completion = '';
    try {
      if (useRealAI && apiKey) {
        addLog('agent', 'Calling OpenRouter for task completion...');
        // Only send field names to AI, not actual values (privacy!)
        const fieldSummary: Record<string, string> = {};
        for (const f of selectedFields) fieldSummary[f] = '[RECEIVED]';
        for (const f of denied) fieldSummary[f] = '[DENIED - PROTECTED]';

        completion = await callOpenRouter(apiKey, `Complete the task. Fields status: ${JSON.stringify(fieldSummary)}`, scenario.completionPrompt(fieldSummary));
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        completion = simulateAICompletion(scenario, selectedFields);
      }
    } catch {
      completion = simulateAICompletion(scenario, selectedFields);
    }

    setAiCompletion(completion);
    addLog('agent', 'Task completed!', 'success');

    // ── Step 5: Server-generated receipt via Supabase Edge Function ──
    setReceiptLoading(true);
    addLog('agent', 'Calling simulate-receipt edge function with approved vault fields...');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/simulate-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'Apikey': supabaseKey,
        },
        body: JSON.stringify({ scenario: scenario.id, fields: scoped }),
      });
      if (res.ok) {
        const { receipt: serverReceipt } = await res.json();
        setReceipt(serverReceipt);
        addLog('sdk', `Receipt issued by server (supabase-edge/simulate-receipt)`, 'success');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      // Fallback to local receipt if edge function unreachable
      setReceipt(generateReceipt(scenario.id, scoped));
      addLog('sdk', 'Edge function unavailable — generated local receipt', 'warning');
    }
    setReceiptLoading(false);
    addLog('agent', `${scenario.id === 'shopping' ? 'Order' : scenario.id === 'travel' ? 'Booking' : 'Intake form'} confirmed`, 'success');
    addLog('system', '🔒 Keys derived in your browser via PBKDF2 — Supabase stores ciphertext only, never plaintext or keys', 'info');

    // ── Step 6: EAS Attestation (on-chain proof) ────────
    if (isEASAvailable()) {
      try {
        // Verify wallet is on Base Mainnet or Base Sepolia
        const chainHex = await (window as any).ethereum?.request({ method: 'eth_chainId' });
        const chainId = chainHex ? parseInt(chainHex, 16) : 0;
        const isBase = chainId === 8453;
        const isBaseSepolia = chainId === 84532;
        if (chainHex && !isBase && !isBaseSepolia) {
          addLog('system', 'EAS skipped — switch MetaMask to Base Mainnet or Base Sepolia', 'warning');
          setStep('done');
          return;
        }

        setAttestationLoading(true);
        addLog('system', `Creating EAS on-chain attestation on ${isBaseSepolia ? 'Base Sepolia' : 'Base Mainnet'}...`, 'info');

        const schemaUID = await registerSchema(isBaseSepolia);
        addLog('system', `Schema registered: ${schemaUID.slice(0, 10)}...`, 'success');

        const result = await createDisclosureAttestation({
          disclosureId: requestId || crypto.randomUUID(),
          agentName: scenario.agentName,
          category: scenario.category,
          approvedFields: selectedFields,
          deniedFields: denied,
          purpose: scenario.purpose,
          schemaUID,
        });

        setAttestationUID(result.attestationUID);
        setAttestationTxHash(result.txHash);
        setAttestationChainId(chainId || 8453);
        addLog('system', `EAS Attestation created! UID: ${result.attestationUID.slice(0, 10)}...`, 'success');
        addLog('system', `Tx: ${result.txHash.slice(0, 10)}...`, 'success');

        // Store in public explorer (fire-and-forget)
        storePublicAttestation({
          easUid: result.attestationUID,
          txHash: result.txHash,
          agentName: scenario.agentName,
          category: scenario.category,
          approvedCount: selectedFields.length,
          deniedCount: denied.length,
          purpose: scenario.purpose,
          chainId: chainId || 8453,
        }).catch(() => {});

        // Pin disclosure metadata to IPFS (additive — never blocks main flow)
        const pinataJwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
        if (pinataJwt) {
          try {
            addLog('system', 'Pinning disclosure to IPFS via Pinata...', 'info');
            const pin = await pinDisclosureToIPFS({
              disclosureId: requestId || crypto.randomUUID(),
              agentName: scenario.agentName,
              category: scenario.category,
              approvedFields: selectedFields,
              deniedFields: denied,
              purpose: scenario.purpose,
              easAttestationUID: result.attestationUID,
              easTxHash: result.txHash,
              timestamp: new Date().toISOString(),
            }, pinataJwt);
            setIpfsCid(pin.cid);
            addLog('system', `IPFS CID: ${pin.cid.slice(0, 12)}...`, 'success');
          } catch (ipfsErr) {
            addLog('system', `IPFS pin skipped: ${ipfsErr instanceof Error ? ipfsErr.message : 'error'}`, 'warning');
          }
        }
      } catch (e) {
        addLog('system', `EAS attestation skipped: ${e instanceof Error ? e.message : 'MetaMask not connected'}`, 'warning');
      } finally {
        setAttestationLoading(false);
      }
    } else {
      addLog('system', 'EAS attestation skipped (no wallet connected)', 'warning');
    }

    setStep('done');
    stopTimer();
  }, [requestedFields, requestId, vaultId, scenario, apiKey, useRealAI, addLog, stopTimer]);

  // ─── Deny Handler ─────────────────────────────────────
  const handleDeny = useCallback(async () => {
    setDeniedFields(requestedFields);
    addLog('vault', 'Access denied — all fields protected', 'error');

    if (vaultId && requestId) {
      try {
        await supabase.from('disclosure_logs').update({
          status: 'denied',
          metadata: { sdk_request: true, demo: true, denial_reason: 'User denied all access' },
        }).eq('id', requestId);
      } catch { /* demo mode */ }
    }

    setStep('denied');
    addLog('sdk', 'Status changed: pending → denied');
    addLog('agent', 'Access denied. Cannot complete task.', 'error');
    stopTimer();
  }, [requestedFields, requestId, vaultId, addLog, stopTimer]);

  const reset = useCallback(() => {
    setStep('idle');
    setLogs([]);
    setAiThinking('');
    setAiCompletion('');
    setRequestId(null);
    setRequestedFields([]);
    setApprovedFields([]);
    setDeniedFields([]);
    setScopedData({});
    setAttestationUID(null);
    setAttestationTxHash(null);
    setAttestationLoading(false);
    setReceipt(null);
    setReceiptLoading(false);
    setIpfsCid(null);
    setChainBlock(null);
    setChainFallbackActive(false);
    setElapsedMs(0);
    stopTimer();
  }, [stopTimer]);

  // ─── Render helpers ───────────────────────────────────
  const sourceColor: Record<string, string> = {
    agent: 'text-violet-400',
    sdk: 'text-cyan-400',
    vault: 'text-emerald-400',
    system: 'text-slate-500',
  };

  const typeColor: Record<string, string> = {
    info: 'text-slate-300',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-rose-400',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ChevronLeft size={18} />
              Back
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Live Agent Integration</h1>
              <p className="text-sm text-slate-400">
                Real AI agent requesting scoped data from your ShadowKey vault in real-time
              </p>
            </div>
            {step !== 'idle' && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                <Clock size={14} className="text-cyan-400" />
                <span className="text-xs font-mono text-slate-300">{(elapsedMs / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>

          {/* Config bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <select
              value={scenario.id}
              onChange={(e) => { setScenario(SCENARIOS.find((s) => s.id === e.target.value)!); reset(); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>

            <div className="flex-1 min-w-[200px]">
              <input
                type="password"
                placeholder="OpenRouter API key (free — openrouter.ai)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/40 focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRealAI}
                onChange={(e) => setUseRealAI(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40"
              />
              <span className="text-xs text-slate-400">Live AI</span>
            </label>

            {step === 'idle' ? (
              <Button onClick={runDemo} size="sm">
                <Sparkles size={14} />
                Launch Agent
              </Button>
            ) : (
              <Button onClick={reset} variant="ghost" size="sm">Reset</Button>
            )}
          </div>
        </div>

        {/* Main split layout */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* ─── LEFT: Agent Panel ────────────────── */}
          <div className="space-y-4">
            {/* Agent info card */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={18} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">{scenario.icon} {scenario.agentName}</h3>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  step === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                  step === 'error' || step === 'denied' ? 'bg-rose-500/20 text-rose-400' :
                  step === 'idle' ? 'bg-slate-700 text-slate-400' :
                  'bg-violet-500/20 text-violet-400'
                }`}>
                  {step === 'idle' ? 'Ready' : step === 'done' ? 'Complete' : step === 'denied' ? 'Denied' : 'Running'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{scenario.purpose}</p>

              {/* Step indicators */}
              <div className="flex items-center gap-1">
                {(['thinking', 'requesting', 'waiting', 'approved', 'completing', 'done'] as const).map((s, i) => {
                  const labels = ['AI Think', 'SDK Call', 'Waiting', 'Approved', 'Process', 'Done'];
                  const active = ['thinking', 'requesting', 'waiting', 'approved', 'completing', 'done'].indexOf(step) >= i;
                  const current = step === s || (s === 'approved' && step === 'completing') || (s === 'approved' && step === 'done');
                  return (
                    <div key={s} className="flex items-center gap-1 flex-1">
                      <div className={`h-1 flex-1 rounded-full transition-colors ${
                        active ? 'bg-cyan-500' : 'bg-slate-700'
                      } ${current ? 'bg-cyan-400 animate-pulse' : ''}`} />
                      <span className={`text-[9px] ${active ? 'text-cyan-400' : 'text-slate-600'}`}>{labels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Thinking output */}
            {aiThinking && (
              <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-violet-400" />
                  <span className="text-xs font-semibold text-violet-300">AI Analysis</span>
                  {useRealAI && apiKey && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">LIVE</span>}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{aiThinking}</p>
              </div>
            )}

            {/* Scoped data received */}
            {Object.keys(scopedData).length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">Scoped Data Received by Agent</span>
                </div>
                <div className="space-y-1.5">
                  {requestedFields.map((field) => {
                    const isApproved = approvedFields.includes(field);
                    return (
                      <div key={field} className="flex items-center gap-2 text-xs">
                        {isApproved ? (
                          <Eye size={12} className="text-emerald-400" />
                        ) : (
                          <EyeOff size={12} className="text-rose-400" />
                        )}
                        <span className="text-slate-500 w-32 font-mono">{field}</span>
                        {isApproved ? (
                          <span className="text-slate-200 font-mono">{scopedData[field]}</span>
                        ) : (
                          <span className="text-rose-400/60 font-mono">████████ [DENIED]</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Completion output */}
            {aiCompletion && (
              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-300">Agent Task Completed</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{aiCompletion}</p>
              </div>
            )}

            {/* Receipt / Task Execution Card */}
            {(receipt || receiptLoading) && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">
                    {scenario.id === 'shopping' ? '🛍️ Order Confirmed' : scenario.id === 'travel' ? '✈️ Booking Confirmed' : '🏥 Intake Form Submitted'}
                  </span>
                  {receiptLoading && <Loader2 size={12} className="text-emerald-400 animate-spin" />}
                </div>
                {receipt ? (
                  <>
                    <div className="space-y-1.5 mb-3">
                      {Object.entries(receipt).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-xs">
                          <span className="text-slate-500 w-32 shrink-0">{key}</span>
                          <span className="text-slate-200 font-mono">{value}</span>
                        </div>
                      ))}
                      {attestationTxHash && (
                        <div className="flex gap-2 text-xs border-t border-slate-800/60 pt-2 mt-2">
                          <span className="text-slate-500 w-32 shrink-0">On-chain proof</span>
                          <a
                            href={getAttestationBasescanUrl(attestationTxHash, attestationChainId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 font-mono truncate flex items-center gap-1 transition-colors"
                          >
                            {attestationTxHash.slice(0, 10)}...{attestationTxHash.slice(-6)}
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-600 border-t border-slate-800 pt-2">
                      ↑ Vault values used locally · EAS attestation written to Base Mainnet
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Processing with approved vault data...</p>
                )}
              </div>
            )}

            {/* EAS Attestation Card */}
            {(attestationUID || attestationLoading) && (
              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300">EAS On-Chain Attestation</span>
                  {attestationLoading && <Loader2 size={12} className="text-indigo-400 animate-spin" />}
                </div>
                {attestationUID ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400">
                      Cryptographic proof that this disclosure was authorized — verifiable by anyone on Base.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={getEASScanUrl(attestationUID, attestationChainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 text-[10px] hover:bg-indigo-500/30 transition-colors"
                      >
                        <ExternalLink size={10} />
                        View on EAS Scan
                      </a>
                      {attestationTxHash && (
                        <a
                          href={getAttestationBasescanUrl(attestationTxHash, attestationChainId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 text-[10px] hover:bg-cyan-500/30 transition-colors"
                        >
                          <ExternalLink size={10} />
                          View on Basescan
                        </a>
                      )}
                    </div>
                    <p className="text-[9px] font-mono text-slate-600 break-all">UID: {attestationUID}</p>
                    {ipfsCid && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${ipfsCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-violet-500/20 text-violet-300 text-[10px] hover:bg-violet-500/30 transition-colors"
                        >
                          <ExternalLink size={10} />
                          IPFS Disclosure Record
                        </a>
                        <p className="text-[9px] font-mono text-slate-600 mt-1 break-all">CID: {ipfsCid}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Creating attestation via MetaMask...</p>
                )}
              </div>
            )}

            {/* Live log feed */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/60">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-400">Live Event Log</span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 font-mono text-[11px] pr-1 scrollbar-thin">
                {logs.length === 0 && (
                  <p className="text-slate-600 italic">Launch an agent to see events...</p>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 shrink-0">{log.time}</span>
                    <span className={`shrink-0 w-12 ${sourceColor[log.source]}`}>[{log.source}]</span>
                    <span className={typeColor[log.type || 'info']}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Vault Owner Panel ─────────── */}
          <div className="space-y-4">
            {/* Vault status */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={18} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Your Privacy Vault</h3>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  step === 'waiting' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                  step === 'approved' || step === 'completing' || step === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                  step === 'denied' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {step === 'waiting' ? 'Action Required' : step === 'approved' || step === 'completing' || step === 'done' ? 'Resolved' : step === 'denied' ? 'Denied' : 'Monitoring'}
                </span>
              </div>
              {vaultId && (
                <p className="text-[10px] text-slate-600 font-mono">Vault: {vaultId.slice(0, 8)}...</p>
              )}
            </div>

            {/* Pending approval card */}
            {step === 'waiting' && requestedFields.length > 0 && (
              <>
                <ApprovalCard
                  scenario={scenario}
                  requestId={requestId}
                  requestedFields={requestedFields}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                />
                {/* QR code for mobile approval */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-300">📱 Approve on Mobile</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">No MetaMask needed</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-lg shrink-0">
                      <QRCodeSVG
                        value={`https://shadowkey-ai.vercel.app/approve?id=${requestId}&agent=${encodeURIComponent(scenario.agentName)}`}
                        size={80}
                        level="M"
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-1">
                      <p>Scan to open the approval UI on your phone.</p>
                      <p>The vault owner can approve or deny field-by-field from any device.</p>
                      {chainFallbackActive && chainBlock && (
                        <p className="text-cyan-500/70">⛓️ Block #{chainBlock.toLocaleString()} — on-chain fallback active</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Idle state */}
            {step === 'idle' && (
              <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/40 text-center">
                <Lock size={32} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">Your vault is secure</p>
                <p className="text-xs text-slate-600 mt-1">Launch an agent to see the approval flow</p>
              </div>
            )}

            {/* Thinking/requesting state */}
            {(step === 'thinking' || step === 'requesting') && (
              <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/40 text-center">
                <Loader2 size={32} className="mx-auto text-cyan-500 mb-3 animate-spin" />
                <p className="text-sm text-slate-400">
                  {step === 'thinking' ? 'Agent is analyzing what data it needs...' : 'SDK request being created...'}
                </p>
              </div>
            )}

            {/* Post-approval summary */}
            {(step === 'approved' || step === 'completing' || step === 'done') && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Disclosure Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <p className="text-lg font-bold text-emerald-400">{approvedFields.length}</p>
                    <p className="text-[10px] text-slate-500">Fields Shared</p>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center">
                    <p className="text-lg font-bold text-rose-400">{deniedFields.length}</p>
                    <p className="text-[10px] text-slate-500">Fields Protected</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {approvedFields.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <CheckCircle size={10} className="text-emerald-400" />
                      <span className="text-emerald-300 font-mono">{f}</span>
                    </div>
                  ))}
                  {deniedFields.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <XCircle size={10} className="text-rose-400" />
                      <span className="text-rose-300/60 font-mono">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Denied state */}
            {step === 'denied' && (
              <div className="p-6 rounded-xl bg-rose-500/5 border border-rose-500/20 text-center">
                <XCircle size={32} className="mx-auto text-rose-400 mb-3" />
                <p className="text-sm font-semibold text-rose-300">Access Denied</p>
                <p className="text-xs text-slate-400 mt-1">All {requestedFields.length} fields remain protected in your vault</p>
              </div>
            )}

            {/* Architecture flow */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/40">
              <h4 className="text-xs font-semibold text-slate-500 mb-3">DATA FLOW</h4>
              <div className="space-y-2">
                {[
                  { icon: Bot, label: 'AI Agent thinks (OpenRouter)', active: step === 'thinking' },
                  { icon: Send, label: 'SDK creates access request', active: step === 'requesting' },
                  { icon: ShieldCheck, label: 'Vault owner reviews & approves', active: step === 'waiting' },
                  { icon: Eye, label: 'Only scoped fields released', active: step === 'approved' || step === 'completing' },
                  { icon: Zap, label: 'Agent completes task', active: step === 'completing' || step === 'done' },
                  { icon: Lock, label: 'EAS attestation on Base', active: step === 'done' && !!attestationUID },
                ].map(({ icon: Icon, label, active }, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    active ? 'bg-cyan-500/10 border border-cyan-500/20' : 'opacity-50'
                  }`}>
                    <Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-600'} />
                    <span className={`text-xs ${active ? 'text-cyan-300' : 'text-slate-600'}`}>{label}</span>
                    {active && <ArrowRight size={12} className="ml-auto text-cyan-500 animate-pulse" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom info */}
        <div className="mt-6 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-cyan-400 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-400 space-y-1">
              <p><strong className="text-cyan-300">How this works:</strong> The AI agent calls OpenRouter's free models to determine what data it needs. It then creates a real disclosure request in your ShadowKey vault via the SDK. You approve or deny specific fields. The agent receives ONLY the approved scoped data — never the full vault. Finally, an <strong className="text-indigo-300">EAS attestation</strong> is created on Base proving the disclosure was authorized — verifiable by anyone on-chain.</p>
              <p>Get a free API key at <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">openrouter.ai</a> — or run without one in simulated mode.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Approval Card Component ────────────────────────────────
function ApprovalCard({ scenario, requestId, requestedFields, onApprove, onDeny }: {
  scenario: Scenario;
  requestId: string | null;
  requestedFields: string[];
  onApprove: (fields: string[]) => void;
  onDeny: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(requestedFields));

  const toggle = (field: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  // Sensitive fields that should be unchecked by default
  const sensitiveFields = ['cvv', 'card_number', 'passport_number', 'ssn'];

  useEffect(() => {
    setSelected(new Set(requestedFields.filter((f) => !sensitiveFields.includes(f))));
  }, [requestedFields]);

  return (
    <div className="p-4 rounded-xl bg-amber-500/5 border-2 border-amber-500/30 animate-pulse-once">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">Access Request</span>
      </div>

      <div className="mb-3 p-2 rounded-lg bg-slate-900/60">
        <p className="text-xs text-slate-400">
          <strong className="text-white">{scenario.agentName}</strong> is requesting access to your <strong className="text-cyan-400">{scenario.category}</strong> data
        </p>
        <p className="text-[10px] text-slate-500 mt-1">Purpose: {scenario.purpose}</p>
        {requestId && (
          <p className="text-[10px] text-slate-600 font-mono mt-1">ID: {requestId.slice(0, 8)}...</p>
        )}
      </div>

      <div className="space-y-1.5 mb-4">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Select fields to share:</p>
        {requestedFields.map((field) => {
          const isSensitive = sensitiveFields.includes(field);
          return (
            <label
              key={field}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                selected.has(field)
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-slate-800/40 border border-slate-700/40'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(field)}
                onChange={() => toggle(field)}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
              />
              <span className={`text-xs font-mono ${selected.has(field) ? 'text-emerald-300' : 'text-slate-400'}`}>
                {field}
              </span>
              {isSensitive && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">SENSITIVE</span>
              )}
            </label>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onApprove(Array.from(selected))}
          disabled={selected.size === 0}
          className="flex-1"
        >
          <CheckCircle size={14} />
          Approve ({selected.size})
        </Button>
        <Button size="sm" variant="danger" onClick={onDeny} className="flex-1">
          <XCircle size={14} />
          Deny All
        </Button>
      </div>
    </div>
  );
}
