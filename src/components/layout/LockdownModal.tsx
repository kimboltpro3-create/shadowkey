import { useState, useEffect } from 'react';
import { ShieldOff, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { executeLockdown } from '../../lib/lockdown';
import { supabase } from '../../lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function LockdownModal({ open, onClose, onComplete }: Props) {
  const { vaultId, addToast } = useApp();
  const [confirmation, setConfirmation] = useState('');
  const [executing, setExecuting] = useState(false);
  const [activePolicies, setActivePolicies] = useState(0);
  const [activePersonas, setActivePersonas] = useState(0);

  useEffect(() => {
    if (!open || !vaultId) return;
    setConfirmation('');
    (async () => {
      const [pol, per] = await Promise.all([
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId).eq('active', true),
        supabase.from('ephemeral_personas').select('id', { count: 'exact', head: true }).eq('vault_id', vaultId).eq('active', true),
      ]);
      setActivePolicies(pol.count || 0);
      setActivePersonas(per.count || 0);
    })();
  }, [open, vaultId]);

  async function handleLockdown() {
    if (!vaultId || confirmation !== 'LOCKDOWN') return;
    setExecuting(true);
    try {
      const result = await executeLockdown(vaultId, 'manual');
      addToast(
        `Lockdown complete: ${result.policies_revoked} policies revoked, ${result.personas_deactivated} personas deactivated`,
        'warning'
      );
      onComplete();
      onClose();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Lockdown failed', 'error');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Emergency Lockdown" width="md">
      <div className="space-y-4">
        <div className="flex items-center justify-center py-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center">
            <ShieldOff size={32} className="text-rose-400" />
          </div>
        </div>

        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle size={14} className="text-rose-400 mt-0.5 shrink-0" />
            <p className="text-sm text-rose-300">This action will immediately:</p>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-400 ml-5">
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              Revoke <span className="text-white font-medium">{activePolicies}</span> active policies
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              Deactivate <span className="text-white font-medium">{activePersonas}</span> active personas
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              Block all agent access to your vault
            </li>
          </ul>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            Type <span className="text-rose-400 font-mono font-bold">LOCKDOWN</span> to confirm
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Type LOCKDOWN..."
            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-rose-500/40"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleLockdown}
            loading={executing}
            disabled={confirmation !== 'LOCKDOWN'}
            className="flex-1"
          >
            <ShieldOff size={13} /> Execute Lockdown
          </Button>
        </div>
      </div>
    </Modal>
  );
}
