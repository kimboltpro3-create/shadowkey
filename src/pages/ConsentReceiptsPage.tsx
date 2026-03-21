import { useState, useEffect, useCallback } from 'react';
import { FileCheck, ShieldCheck, Copy, Download, Search, CheckCircle, Users, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadConsentReceipts, verifyReceiptSignature } from '../lib/consentReceipts';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/constants';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { ConsentReceipt, SecretCategory } from '../types';

function truncate(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function ReceiptCard({ receipt }: { receipt: ConsentReceipt }) {
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const colors = CATEGORY_COLORS[receipt.category as SecretCategory];

  async function handleVerify() {
    setVerifying(true);
    try {
      const valid = await verifyReceiptSignature(receipt.receipt_hash, receipt.wallet_signature, receipt.signer_address);
      setVerified(valid);
    } catch {
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(receipt.receipt_hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receipt.receipt_hash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 hover:border-sky-300 dark:border-slate-700/40 rounded-xl transition-all">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">{CATEGORY_LABELS[receipt.category as SecretCategory]}</Badge>
            {verified === true && <Badge variant="success">Verified</Badge>}
            {verified === false && <Badge variant="danger">Invalid</Badge>}
            {receipt.is_demo_signature && <Badge variant="warning">Demo Signature</Badge>}
            {receipt.amount && <span className="text-xs text-emerald-400 font-medium">${receipt.amount}</span>}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-600 whitespace-nowrap">
            {new Date(receipt.created_at).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-600 dark:text-slate-500">
            <Users size={11} />
            <span>Agent:</span>
            <span className="text-slate-900 dark:text-white font-mono">{truncate(receipt.agent_address)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-600 dark:text-slate-500">
            <Building2 size={11} />
            <span>Service:</span>
            <span className="text-slate-900 dark:text-white font-mono">{truncate(receipt.service_address)}</span>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5">Fields disclosed</p>
          <div className="flex flex-wrap gap-1">
            {receipt.fields_disclosed.map((f) => (
              <span key={f} className={`px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text} border ${colors.border}`}>
                {f.replace(/_/g, ' ')}
              </span>
            ))}
            {receipt.fields_disclosed.length === 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-600">No fields recorded</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 bg-sky-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
          <FileCheck size={12} className="text-slate-500 dark:text-slate-600 dark:text-slate-500 shrink-0" />
          <span className="text-xs font-mono text-slate-400 truncate flex-1">{receipt.receipt_hash}</span>
          <button onClick={handleCopy} className="text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:text-white transition-colors shrink-0" title="Copy hash">
            {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleVerify} loading={verifying}>
            <ShieldCheck size={12} /> Verify
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download size={12} /> Export
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConsentReceiptsPage() {
  const { vaultId, addToast } = useApp();
  const [receipts, setReceipts] = useState<ConsentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchHash, setSearchHash] = useState('');

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const data = await loadConsentReceipts(vaultId);
      setReceipts(data);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load receipts', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = searchHash
    ? receipts.filter((r) => r.receipt_hash.toLowerCase().includes(searchHash.toLowerCase()))
    : receipts;

  const uniqueServices = new Set(receipts.map((r) => r.service_address)).size;
  const uniqueAgents = new Set(receipts.map((r) => r.agent_address)).size;

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Consent Receipts</h1>
        <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500">Cryptographic proof of every disclosure from your vault</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-slate-900 dark:text-white">{receipts.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Total Receipts</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-emerald-400">{receipts.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Signed</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{uniqueServices}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Services</p>
        </div>
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-amber-400">{uniqueAgents}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500">Agents</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchHash}
          onChange={(e) => setSearchHash(e.target.value)}
          placeholder="Search by receipt hash..."
          className="w-full pl-9 pr-3 py-2 bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-slate-700/40 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:text-slate-600 focus:outline-none focus:border-cyan-500/40"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileCheck size={40} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1">No consent receipts found</p>
          <p className="text-xs text-slate-500 dark:text-slate-600">
            {searchHash ? 'No receipts match your search' : 'Receipts are generated automatically when data is disclosed via the Live Demo'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((receipt) => (
            <ReceiptCard key={receipt.id} receipt={receipt} />
          ))}
        </div>
      )}
    </div>
  );
}
