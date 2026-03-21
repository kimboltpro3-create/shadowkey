import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { createPolicy } from '../../lib/shadowVault';
import { CATEGORY_LABELS, CATEGORY_FIELDS, EXPIRY_PRESETS } from '../../lib/constants';
import type { SecretCategory } from '../../types';

interface CreatePolicyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES: SecretCategory[] = ['payment', 'identity', 'credentials', 'health', 'preferences'];

export function CreatePolicyModal({ open, onClose, onCreated }: CreatePolicyModalProps) {
  const { vaultId, addToast } = useApp();
  const [agentAddress, setAgentAddress] = useState('');
  const [agentAlias, setAgentAlias] = useState('');
  const [category, setCategory] = useState<SecretCategory>('payment');
  const [spendLimit, setSpendLimit] = useState('');
  const [totalLimit, setTotalLimit] = useState('');
  const [allowedServices, setAllowedServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);
  const [revealFields, setRevealFields] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const allFields = CATEGORY_FIELDS[category];
  const hiddenFields = allFields.filter((f) => !revealFields.includes(f));

  function toggleRevealField(field: string) {
    setRevealFields((prev) => prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]);
  }

  function addService() {
    const s = serviceInput.trim();
    if (!s || allowedServices.includes(s)) return;
    setAllowedServices((prev) => [...prev, s]);
    setServiceInput('');
  }

  async function handleCreate() {
    if (!vaultId) return;
    if (!agentAddress.trim()) { addToast('Agent address is required', 'warning'); return; }

    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(agentAddress.trim())) {
      addToast('Invalid Ethereum address format', 'warning');
      return;
    }

    if (revealFields.length === 0) { addToast('Select at least one field to reveal', 'warning'); return; }

    const spendLimitNum = parseFloat(spendLimit) || 0;
    const totalLimitNum = parseFloat(totalLimit) || 0;

    if (spendLimitNum < 0 || totalLimitNum < 0) {
      addToast('Spend limits cannot be negative', 'warning');
      return;
    }

    setSaving(true);
    try {
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      await createPolicy(vaultId, {
        agent_address: agentAddress.trim(),
        agent_alias: agentAlias.trim() || undefined,
        category,
        spend_limit: spendLimitNum,
        total_limit: totalLimitNum,
        allowed_services: allowedServices.length > 0 ? allowedServices : ['any'],
        expires_at: expiresAt,
        reveal_fields: revealFields,
        hidden_fields: hiddenFields,
        active: true,
      });
      addToast('Policy created on-chain', 'success');
      setAgentAddress(''); setAgentAlias(''); setCategory('payment');
      setSpendLimit(''); setTotalLimit(''); setAllowedServices([]); setRevealFields([]);
      setExpiryDays(30); setServiceInput('');
      onCreated();
      onClose();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create policy', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Disclosure Policy" width="xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent Address <span className="text-rose-400">*</span></label>
            <input
              value={agentAddress}
              onChange={(e) => setAgentAddress(e.target.value)}
              placeholder="0x... (ERC-8004 agent identity)"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent Alias (optional)</label>
            <input
              value={agentAlias}
              onChange={(e) => setAgentAlias(e.target.value)}
              placeholder="e.g. Shopping Agent, Travel Bot"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Secret Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setRevealFields([]); }}
                className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  category === cat
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-600'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Per-transaction limit ($)</label>
            <input type="number" value={spendLimit} onChange={(e) => setSpendLimit(e.target.value)} placeholder="0 = no limit" min="0"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Cumulative limit ($)</label>
            <input type="number" value={totalLimit} onChange={(e) => setTotalLimit(e.target.value)} placeholder="0 = no limit" min="0"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Policy expiry</label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {EXPIRY_PRESETS.map(({ label, days }) => (
              <button key={days} onClick={() => setExpiryDays(days)}
                className={`px-2 py-1.5 rounded-lg text-xs border transition-all ${
                  expiryDays === days
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">or custom days:</span>
            <input type="number" value={expiryDays} onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)} min="1"
              className="w-20 bg-slate-800/60 border border-slate-700/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/60" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Allowed services (leave empty for any)</label>
          <div className="flex gap-2 mb-2">
            <input value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addService()}
              placeholder="0x... address or 'any'"
              className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500/60 transition-all" />
            <Button size="sm" variant="secondary" onClick={addService}><Plus size={12} /></Button>
          </div>
          {allowedServices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allowedServices.map((s) => (
                <span key={s} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/40 text-xs text-slate-300 font-mono">
                  {s.length > 14 ? `${s.slice(0, 8)}...${s.slice(-4)}` : s}
                  <button onClick={() => setAllowedServices((prev) => prev.filter((x) => x !== s))} className="text-slate-600 hover:text-rose-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Field disclosure rules <span className="text-rose-400">*</span></label>
          <p className="text-xs text-slate-600 mb-2">Check fields the agent IS allowed to see</p>
          <div className="grid grid-cols-2 gap-2">
            {allFields.map((field) => {
              const isRevealed = revealFields.includes(field);
              return (
                <button key={field} onClick={() => toggleRevealField(field)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all text-left ${
                    isRevealed
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isRevealed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                    {isRevealed && <span className="text-white text-xs font-bold leading-none">✓</span>}
                  </div>
                  {field.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
          {hiddenFields.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
              <p className="text-xs text-rose-400/80">
                <span className="font-medium">Withheld from agent:</span>{' '}
                {hiddenFields.map((f) => f.replace(/_/g, ' ')).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/60">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleCreate} loading={saving} className="flex-1">Deploy Policy On-Chain</Button>
      </div>
    </Modal>
  );
}
