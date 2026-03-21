import { useState, useEffect, useCallback } from 'react';
import {
  Ghost, Plus, Trash2, Clock, Shield, Copy, RefreshCw,
  ChevronDown, ChevronUp, Fingerprint, ArrowRight, XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadPersonas, createPersona, deactivatePersona, loadPolicies } from '../lib/shadowVault';
import { useRealtime } from '../lib/realtime';
import { CATEGORY_FIELDS, EXPIRY_PRESETS } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { EphemeralPersona, Policy, SecretCategory } from '../types';

const PERSONA_PREFIXES = ['Shadow', 'Ghost', 'Phantom', 'Cipher', 'Void', 'Zero', 'Null', 'Anon', 'Stealth', 'Fade'];
const PERSONA_SUFFIXES = ['Walker', 'Runner', 'Agent', 'Proxy', 'Node', 'Relay', 'Shield', 'Mask', 'Veil', 'Key'];

function generateAlias(): string {
  const prefix = PERSONA_PREFIXES[Math.floor(Math.random() * PERSONA_PREFIXES.length)];
  const suffix = PERSONA_SUFFIXES[Math.floor(Math.random() * PERSONA_SUFFIXES.length)];
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${suffix}-${num}`;
}

function generateFieldSubstitutions(category: SecretCategory): Record<string, string> {
  const fields = CATEGORY_FIELDS[category] || [];
  const subs: Record<string, string> = {};
  for (const field of fields) {
    if (field.includes('name') || field === 'email') {
      subs[field] = `[REDACTED-${Math.random().toString(36).slice(2, 6).toUpperCase()}]`;
    } else if (field.includes('address') && !field.includes('service')) {
      subs[field] = `Persona address ${Math.floor(Math.random() * 9000 + 1000)}`;
    }
  }
  return subs;
}

function truncate(addr: string) {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

function PersonaCard({ persona, onDeactivate }: { persona: EphemeralPersona; onDeactivate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(persona.expires_at) <= new Date();
  const isActive = persona.active && !isExpired;
  const mappedEntries = Object.entries(persona.mapped_fields);

  function copyAddress() {
    navigator.clipboard.writeText(persona.persona_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`rounded-xl border transition-all ${
      isActive ? 'border-sky-200 dark:border-sky-200 dark:border-slate-800/60 bg-white dark:bg-white dark:bg-slate-900/60 hover:border-sky-300 dark:hover:border-sky-300 dark:border-slate-700/40'
        : 'border-slate-300 dark:border-slate-800/40 bg-slate-50 dark:bg-slate-900/30 opacity-60'
    }`}>
      <div className="flex items-center gap-3 p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isActive ? 'bg-teal-500/15 border border-teal-500/30' : 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-sky-300 dark:border-slate-700/40'
        }`}>
          <Ghost size={18} className={isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-900 dark:text-white">{persona.persona_alias}</span>
            {isActive ? (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 text-xs">Active</span>
            ) : isExpired ? (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-500 dark:text-slate-600 dark:text-slate-500 text-xs">Expired</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs">Deactivated</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">{truncate(persona.persona_address)}</span>
            <button onClick={copyAddress} className="text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400 transition-colors">
              <Copy size={10} />
            </button>
            {copied && <span className="text-xs text-cyan-600 dark:text-cyan-400">Copied</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-2 hidden sm:block">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">
              <Clock size={10} />
              {isExpired ? 'Expired' : `Expires ${new Date(persona.expires_at).toLocaleDateString()}`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600 mt-0.5">
              {mappedEntries.length} field {mappedEntries.length === 1 ? 'substitution' : 'substitutions'}
            </div>
          </div>
          {isActive && (
            <Button variant="danger" size="sm" onClick={onDeactivate}>
              <XCircle size={12} />
            </Button>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400 transition-all">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-sky-200 dark:border-slate-800/60 px-4 py-3 animate-fade-in">
          <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-2">Field Substitutions</p>
          {mappedEntries.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600">No field mappings configured</p>
          ) : (
            <div className="space-y-1.5">
              {mappedEntries.map(([field, sub]) => (
                <div key={field} className="flex items-center gap-2 text-xs">
                  <span className="text-rose-400 line-through w-32 flex-shrink-0">{field.replace(/_/g, ' ')}</span>
                  <ArrowRight size={10} className="text-slate-700" />
                  <span className="text-teal-600 dark:text-teal-400 font-mono">{sub}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 p-2 rounded-lg bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/40 border border-sky-300 dark:border-slate-700/30">
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600">
              Created {new Date(persona.created_at).toLocaleDateString()} at {new Date(persona.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CreatePersonaModal({
  open, onClose, onCreated, policies,
}: {
  open: boolean; onClose: () => void; onCreated: () => void; policies: Policy[];
}) {
  const { vaultId, addToast } = useApp();
  const [alias, setAlias] = useState(generateAlias());
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [category, setCategory] = useState<SecretCategory>('identity');
  const [expiryDays, setExpiryDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const activePolicies = policies.filter((p) => p.active && new Date(p.expires_at) > new Date());
  const mappedFields = generateFieldSubstitutions(category);

  async function handleCreate() {
    if (!vaultId) return;
    setCreating(true);
    try {
      await createPersona(
        vaultId,
        selectedPolicy || null,
        alias,
        mappedFields,
        new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      );
      addToast('Ephemeral persona created', 'success');
      onCreated();
      onClose();
      setAlias(generateAlias());
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create persona', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Ephemeral Persona" width="lg">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Persona Alias</label>
          <div className="flex gap-2">
            <input value={alias} onChange={(e) => setAlias(e.target.value)}
              className="flex-1 bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60" />
            <button onClick={() => setAlias(generateAlias())}
              className="p-2 rounded-lg bg-sky-50 dark:bg-slate-800 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Link to Policy (optional)</label>
          <select value={selectedPolicy} onChange={(e) => setSelectedPolicy(e.target.value)}
            className="w-full bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border border-sky-300 dark:border-sky-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/60">
            <option value="">No linked policy</option>
            {activePolicies.map((p) => (
              <option key={p.id} value={p.id}>{p.agent_alias || truncate(p.agent_address)} — {p.category}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Category (for field substitutions)</label>
          <div className="flex flex-wrap gap-1.5">
            {(['identity', 'payment', 'credentials', 'health', 'preferences'] as SecretCategory[]).map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize border transition-all ${
                  category === cat ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                    : 'bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}>{cat}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mb-1.5 block">Expires</label>
          <div className="flex gap-1.5">
            {EXPIRY_PRESETS.map(({ label, days }) => (
              <button key={days} onClick={() => setExpiryDays(days)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  expiryDays === days ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                    : 'bg-sky-50 dark:bg-sky-50 dark:bg-slate-800/60 border-sky-300 dark:border-sky-300 dark:border-slate-700/40 text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {Object.keys(mappedFields).length > 0 && (
          <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20">
            <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mb-2 flex items-center gap-1.5">
              <Fingerprint size={12} /> Auto-generated field substitutions
            </p>
            <div className="space-y-1">
              {Object.entries(mappedFields).map(([field, sub]) => (
                <div key={field} className="flex items-center gap-2 text-xs">
                  <span className="text-rose-400 line-through">{field.replace(/_/g, ' ')}</span>
                  <ArrowRight size={10} className="text-slate-700" />
                  <span className="text-teal-600 dark:text-teal-400 font-mono">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} loading={creating}>
            <Ghost size={12} /> Create Persona
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PersonasPage() {
  const { vaultId, addToast } = useApp();
  const [personas, setPersonas] = useState<EphemeralPersona[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!vaultId) return;
    try {
      const [p, pol] = await Promise.all([loadPersonas(vaultId), loadPolicies(vaultId)]);
      setPersonas(p);
      setPolicies(pol);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to load personas', 'error');
    } finally {
      setLoading(false);
    }
  }, [vaultId, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useRealtime({ table: 'ephemeral_personas', filter: vaultId ? `vault_id=eq.${vaultId}` : undefined, onChange: refresh, enabled: !!vaultId });

  async function handleDeactivate(id: string) {
    try {
      await deactivatePersona(id);
      addToast('Persona deactivated', 'success');
      await refresh();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to deactivate', 'error');
    }
  }

  const active = personas.filter((p) => p.active && new Date(p.expires_at) > new Date());
  const inactive = personas.filter((p) => !p.active || new Date(p.expires_at) <= new Date());

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white dark:bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-sky-200 dark:border-slate-800/60 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">Ephemeral Personas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-0.5">Temporary pseudonymous identities that prevent metadata correlation</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm"><Plus size={14} /> New Persona</Button>
      </div>

      <div className="mb-6 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20">
        <div className="flex items-start gap-2">
          <Ghost size={14} className="text-teal-600 dark:text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-teal-700 dark:text-teal-300 font-medium">Why Ephemeral Personas?</p>
            <p className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500 mt-1 leading-relaxed">
              Even with field-level scoping, services can correlate metadata across transactions (same shipping address, same payment token).
              Ephemeral personas generate a fresh pseudonymous identity per interaction — different alias, different address, substituted fields —
              so no two services can link your activity together.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Ghost size={13} className="text-teal-600 dark:text-teal-600 dark:text-teal-400" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{active.length}</p>
        </div>
        <div className="bg-white dark:bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 size={13} className="text-slate-500 dark:text-slate-600 dark:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">Expired/Deactivated</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{inactive.length}</p>
        </div>
        <div className="bg-white dark:bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={13} className="text-cyan-600 dark:text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-600 dark:text-slate-500">Total created</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{personas.length}</p>
        </div>
      </div>

      {personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-center mb-4">
            <Ghost size={24} className="text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-700" />
          </div>
          <p className="text-slate-500 dark:text-slate-600 dark:text-slate-400 font-medium mb-1">No personas yet</p>
          <p className="text-slate-500 dark:text-slate-600 dark:text-slate-500 dark:text-slate-500 dark:text-slate-600 text-sm mb-4">Create an ephemeral persona to break metadata correlation</p>
          <Button onClick={() => setCreateOpen(true)} size="sm"><Plus size={14} /> Create First Persona</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {personas.map((p) => (
            <PersonaCard key={p.id} persona={p} onDeactivate={() => handleDeactivate(p.id)} />
          ))}
        </div>
      )}

      <CreatePersonaModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} policies={policies} />
    </div>
  );
}
