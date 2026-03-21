import { useState } from 'react';
import { Eye, EyeOff, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { VaultSecret, SecretField } from '../../types';
import { CATEGORY_LABELS } from '../../lib/constants';
import { decryptSecret, deleteSecret } from '../../lib/shadowVault';
import { useApp } from '../../context/AppContext';
import { CategoryIcon } from './CategoryIcon';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface SecretCardProps {
  secret: VaultSecret;
  onDeleted: () => void;
}

export function SecretCard({ secret, onDeleted }: SecretCardProps) {
  const { vaultId, vaultKey, addToast } = useApp();
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<SecretField[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleReveal() {
    if (!vaultKey) return;
    if (revealed) {
      setRevealed(false);
      setFields([]);
      return;
    }
    setDecrypting(true);
    try {
      const decrypted = await decryptSecret(secret, vaultKey);
      setFields(decrypted);
      setRevealed(true);
      setExpanded(true);
    } catch {
      addToast('Decryption failed — wrong key?', 'error');
    } finally {
      setDecrypting(false);
    }
  }

  async function handleDelete() {
    if (!vaultId) return;
    if (!confirm(`Delete secret "${secret.label}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteSecret(secret.id, vaultId);
      addToast('Secret deleted', 'success');
      onDeleted();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 hover:border-sky-300 dark:hover:border-slate-700/40 rounded-xl transition-all">
      <div className="flex items-center gap-3 px-4 py-3">
        <CategoryIcon category={secret.category} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{secret.label}</span>
            <Badge variant="default">{CATEGORY_LABELS[secret.category]}</Badge>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-600">{new Date(secret.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReveal}
            disabled={decrypting}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-500 hover:text-sky-600 dark:hover:text-cyan-400 hover:bg-sky-100 dark:hover:bg-cyan-500/10 transition-all disabled:opacity-40"
          >
            {decrypting
              ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin block" />
              : revealed ? <EyeOff size={14} /> : <Eye size={14} />
            }
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-700/40 transition-all"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <Button variant="ghost" size="sm" onClick={handleDelete} loading={deleting} className="text-slate-600 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-sky-200 dark:border-slate-800/60 px-4 py-3">
          {revealed ? (
            <div className="space-y-1.5">
              {fields.map((f) => (
                <div key={f.key} className="flex gap-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-500 w-36 flex-shrink-0 font-mono text-xs pt-0.5">{f.key.replace(/_/g, ' ')}</span>
                  <span className="text-slate-900 dark:text-white font-mono text-xs break-all">{f.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-24 h-3 bg-sky-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="w-32 h-3 bg-sky-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </div>
              ))}
              <p className="text-xs text-slate-500 dark:text-slate-600 mt-2">Click the eye icon to decrypt and reveal</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
