import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { storeSecret } from '../../lib/shadowVault';
import { CATEGORY_LABELS, CATEGORY_FIELDS } from '../../lib/constants';
import type { SecretCategory, SecretField } from '../../types';

interface AddSecretModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const CATEGORIES: SecretCategory[] = ['payment', 'identity', 'credentials', 'health', 'preferences'];

interface FieldWithId extends SecretField {
  id: string;
}

let fieldIdCounter = 0;

export function AddSecretModal({ open, onClose, onAdded }: AddSecretModalProps) {
  const { vaultId, vaultKey, addToast } = useApp();
  const [category, setCategory] = useState<SecretCategory>('payment');
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<FieldWithId[]>([{ key: '', value: '', id: `field-${fieldIdCounter++}` }]);
  const [saving, setSaving] = useState(false);

  const suggestedFields = CATEGORY_FIELDS[category];

  function addField() { setFields((prev) => [...prev, { key: '', value: '', id: `field-${fieldIdCounter++}` }]); }
  function removeField(index: number) { setFields((prev) => prev.filter((_, i) => i !== index)); }
  function updateField(index: number, part: 'key' | 'value', val: string) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, [part]: val } : f)));
  }
  function addSuggestedField(fieldKey: string) {
    if (fields.some((f) => f.key === fieldKey)) return;
    setFields((prev) => [...prev.filter((f) => f.key !== ''), { key: fieldKey, value: '', id: `field-${fieldIdCounter++}` }]);
  }

  function resetForm() {
    setCategory('payment');
    setLabel('');
    setFields([{ key: '', value: '', id: `field-${fieldIdCounter++}` }]);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSave() {
    if (!vaultId || !vaultKey) return;
    const validFields = fields.filter((f) => f.key.trim() && f.value.trim());
    if (!label.trim() || validFields.length === 0) {
      addToast('Please fill in a label and at least one field', 'warning');
      return;
    }
    setSaving(true);
    try {
      await storeSecret(vaultId, category, label.trim(), validFields, vaultKey);
      addToast('Secret stored securely', 'success');
      resetForm();
      onAdded();
      onClose();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to save secret', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Secret" width="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  category === cat
                    ? 'bg-sky-500/15 dark:bg-cyan-500/15 border-sky-500/40 dark:border-cyan-500/40 text-sky-700 dark:text-cyan-300'
                    : 'bg-white dark:bg-slate-800/60 border-sky-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:border-sky-400 dark:hover:border-slate-600'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Visa ending 4242"
            className="w-full bg-white dark:bg-slate-800/60 border border-sky-200 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-500/60 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Fields</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {suggestedFields.map((sf) => (
              <button
                key={sf}
                onClick={() => addSuggestedField(sf)}
                disabled={fields.some((f) => f.key === sf)}
                className={`px-2 py-0.5 rounded-md text-xs transition-all border ${
                  fields.some((f) => f.key === sf)
                    ? 'bg-slate-200 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-500 cursor-default'
                    : 'bg-sky-100 dark:bg-slate-800 border-sky-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 hover:border-sky-400 dark:hover:border-slate-600 cursor-pointer'
                }`}
              >
                + {sf.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateField(i, 'key', e.target.value)}
                  placeholder="field name"
                  className="flex-1 bg-white dark:bg-slate-800/60 border border-sky-200 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-500/60 transition-all"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => updateField(i, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-white dark:bg-slate-800/60 border border-sky-200 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-500/60 transition-all"
                />
                {fields.length > 1 && (
                  <button
                    onClick={() => removeField(i)}
                    className="p-2 rounded-lg text-slate-500 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addField} className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">
            <Plus size={12} /> Add field
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">Encrypt & Store</Button>
        </div>
      </div>
    </Modal>
  );
}
