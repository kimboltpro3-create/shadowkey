import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Database, Info, Download, AlertTriangle,
  Trash2, Copy, CheckCircle, Server, Activity, Zap, RefreshCw, Key, Eye, EyeOff, Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getVaultStats, revokeAllVaultAccess } from '../lib/shadowVault';
import { exportVault, exportLocalVault, importVault, importVaultLocal } from '../lib/backup';
import { loadLockdownHistory, markRestored } from '../lib/lockdown';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import type { LockdownEvent } from '../types';

function truncate(addr: string) {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-4)}`;
}

interface VaultStats {
  secrets: number;
  activePolicies: number;
  activePersonas: number;
  totalDisclosures: number;
  weeklyDisclosures: number;
  pendingRequests: number;
  deadManActive: boolean;
  budgetsSet: number;
}

interface APIKey {
  id: string;
  key_name: string;
  key_prefix: string;
  rate_limit_tier: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
}

function StatRow({ label, value, color = 'text-slate-900 dark:text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-slate-600 dark:text-slate-500 text-sm">{label}</span>
      <span className={`${color} font-mono text-sm`}>{value}</span>
    </div>
  );
}

export function SettingsPage() {
  const { walletAddress, vaultId, disconnectWallet, addToast, isLocalMode, setLocalMode, isAuthenticated } = useApp();
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lockdownHistory, setLockdownHistory] = useState<LockdownEvent[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!vaultId) return;
    setLoadingStats(true);
    try {
      const s = await getVaultStats(vaultId);
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [vaultId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (!vaultId) return;
    loadLockdownHistory(vaultId).then(setLockdownHistory).catch(() => {});
  }, [vaultId]);

  const fetchApiKeys = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const { data, error } = await supabase
        .from('agent_api_keys')
        .select('*')
        .eq('user_address', walletAddress)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setApiKeys(data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
  }, [walletAddress]);

  useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);

  async function generateApiKey(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'sk_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleCreateApiKey() {
    if (!walletAddress || !newKeyName.trim()) return;

    setCreatingKey(true);
    try {
      const apiKey = await generateApiKey();
      const keyHash = await hashApiKey(apiKey);
      const keyPrefix = apiKey.substring(0, 12);

      const { error } = await supabase
        .from('agent_api_keys')
        .insert({
          user_address: walletAddress,
          key_name: newKeyName.trim(),
          key_hash: keyHash,
          key_prefix: keyPrefix,
          is_active: true
        });

      if (error) throw error;

      setNewlyCreatedKey(apiKey);
      setNewKeyName('');
      setShowCreateKey(false);
      await fetchApiKeys();
      addToast('API key created successfully', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create API key', 'error');
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeApiKey(keyId: string) {
    try {
      const { error } = await supabase
        .from('agent_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;

      await fetchApiKeys();
      addToast('API key revoked', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke key', 'error');
    }
  }

  function toggleKeyVisibility(keyId: string) {
    setRevealedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  }

  async function handleMarkRestored(id: string) {
    setRestoringId(id);
    try {
      await markRestored(id);
      const updated = await loadLockdownHistory(vaultId!);
      setLockdownHistory(updated);
      addToast('Lockdown marked as restored', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setRestoringId(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleExport() {
    if (!vaultId) return;
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        vaultId,
        walletAddress,
        stats,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadowkey-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Vault metadata exported', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  }

  async function handleRevokeAll() {
    if (!vaultId) return;
    setRevoking(true);
    try {
      await revokeAllVaultAccess(vaultId);
      addToast('All policies revoked. All personas deactivated. All pending requests expired.', 'warning');
      setConfirmRevoke(false);
      await fetchStats();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke', 'error');
    } finally {
      setRevoking(false);
    }
  }

  function handleLockVault() {
    setConfirmDelete(false);
    disconnectWallet();
  }

  async function handleBackupVault() {
    if (!vaultId) return;
    setBackupLoading(true);
    try {
      if (isLocalMode && walletAddress) {
        exportLocalVault(walletAddress);
      } else {
        await exportVault(vaultId);
      }
      addToast('Encrypted vault backup downloaded', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Backup failed', 'error');
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreVault(e: React.ChangeEvent<HTMLInputElement>) {
    if (!vaultId || !e.target.files?.[0]) return;
    setRestoreLoading(true);
    try {
      let restored: number, skipped: number;
      if (isLocalMode && walletAddress) {
        ({ restored, skipped } = await importVaultLocal(e.target.files[0], walletAddress));
      } else {
        ({ restored, skipped } = await importVault(e.target.files[0], vaultId));
      }
      addToast(`Restored ${restored} secret${restored !== 1 ? 's' : ''} (${skipped} already existed)`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Restore failed', 'error');
    } finally {
      setRestoreLoading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">Vault configuration and management</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} loading={loadingStats}>
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Vault Identity</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-500 text-sm">Wallet</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 dark:text-white font-mono text-sm">{truncate(walletAddress || '')}</span>
                {walletAddress && (
                  <button onClick={() => copyToClipboard(walletAddress, 'wallet')} className="text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400 transition-colors">
                    {copied === 'wallet' ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-500 text-sm">Vault ID</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 dark:text-white font-mono text-xs">{truncate(vaultId || 'Not created')}</span>
                {vaultId && (
                  <button onClick={() => copyToClipboard(vaultId, 'vault')} className="text-slate-500 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400 transition-colors">
                    {copied === 'vault' ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {stats && (
          <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-sky-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Vault Statistics</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6">
              <StatRow label="Secrets stored" value={stats.secrets} />
              <StatRow label="Active policies" value={stats.activePolicies} color="text-emerald-500 dark:text-emerald-400" />
              <StatRow label="Total disclosures" value={stats.totalDisclosures} />
              <StatRow label="This week" value={stats.weeklyDisclosures} />
              <StatRow label="Budgets configured" value={stats.budgetsSet} />
              <StatRow label="Active personas" value={stats.activePersonas} color="text-teal-500 dark:text-teal-400" />
              <StatRow label="Pending requests" value={stats.pendingRequests} />
              <StatRow label="Dead man switch" value={stats.deadManActive ? 'Active' : 'Off'} color={stats.deadManActive ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-600'} />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Encryption</h2>
          </div>
          <div className="space-y-0">
            <StatRow label="Algorithm" value="AES-GCM 256-bit" />
            <StatRow label="Key derivation" value="PBKDF2 SHA-256 100k" />
            <StatRow label="Key source" value="Wallet signature" />
            <StatRow label="Client-side only" value="Yes" color="text-emerald-500 dark:text-emerald-400" />
            <StatRow label="Auth verified" value={isAuthenticated ? 'Yes (server-side)' : 'Pending'} color={isAuthenticated ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'} />
          </div>
        </div>

        {/* Storage Mode — Local vs Supabase */}
        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Storage Mode</h2>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Local Mode</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Store encrypted vault in browser localStorage — no Supabase needed.
                {isLocalMode && <span className="text-amber-400 ml-1">Export a backup regularly.</span>}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={isLocalMode}
              onClick={() => setLocalMode(!isLocalMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isLocalMode ? 'bg-cyan-500' : 'bg-slate-600 dark:bg-slate-700'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLocalMode ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Current: <span className={isLocalMode ? 'text-cyan-400 font-medium' : 'text-teal-400 font-medium'}>
              {isLocalMode ? 'Browser localStorage (offline-capable)' : 'Supabase (cloud-backed)'}
            </span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-sky-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Agent API Keys</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowCreateKey(true)}>
              <Plus size={12} /> Create Key
            </Button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-500 mb-3">
            Generate API keys for AI agents to request access to your vault using the ShadowKey SDK.
          </p>

          {newlyCreatedKey && (
            <div className="mb-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">New API Key Created</p>
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 text-xs font-mono text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900/60 px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700">
                  {newlyCreatedKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey, 'newKey')}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  {copied === 'newKey' ? <CheckCircle size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Save this key now. You will not be able to see it again.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setNewlyCreatedKey(null)} className="mt-2">
                Done
              </Button>
            </div>
          )}

          {showCreateKey && (
            <div className="mb-3 p-3 rounded-lg bg-sky-50 dark:bg-slate-800/40 border border-sky-200 dark:border-slate-700/40">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Shopping Assistant"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-cyan-400 text-slate-900 dark:text-white mb-2"
              />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleCreateApiKey} loading={creatingKey} disabled={!newKeyName.trim()}>
                  Generate Key
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateKey(false); setNewKeyName(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {apiKeys.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-600 text-center py-3">
              No API keys created yet
            </p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                    key.is_active
                      ? 'bg-sky-50 dark:bg-slate-800/40 border border-sky-200 dark:border-slate-700/40'
                      : 'bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700/20 opacity-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {key.key_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-slate-600 dark:text-slate-500">
                        {key.key_prefix}...
                      </code>
                      <span className="text-xs text-slate-500 dark:text-slate-600">
                        {key.request_count} requests
                      </span>
                      {key.last_used_at && (
                        <span className="text-xs text-slate-500 dark:text-slate-600">
                          Last: {new Date(key.last_used_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {key.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeApiKey(key.id)}
                    >
                      <Trash2 size={12} /> Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Infrastructure</h2>
          </div>
          <div className="space-y-0">
            <StatRow label="Network" value="Base (Simulated)" />
            <StatRow label="Agent identity" value="ERC-8004 (simulated)" />
            <StatRow label="Backend" value="Supabase" />
            <StatRow label="Edge Functions" value="3 deployed" color="text-emerald-500 dark:text-emerald-400" />
            <StatRow label="Real-time" value="Enabled" color="text-emerald-500 dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-sky-200 dark:border-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Download size={14} className="text-sky-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Data Export</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-500 mb-3">
            Export vault metadata (statistics, configuration). Encrypted secrets are not included in the export
            since they can only be decrypted with your wallet signature.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download size={12} /> Export Vault Metadata
            </Button>
            <Button variant="outline" size="sm" onClick={handleBackupVault} disabled={backupLoading}>
              <Download size={12} /> {backupLoading ? 'Exporting...' : 'Download Encrypted Backup'}
            </Button>
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${restoreLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Download size={12} className="rotate-180" />
              {restoreLoading ? 'Restoring...' : 'Restore from Backup'}
              <input type="file" accept=".json" className="hidden" onChange={handleRestoreVault} />
            </label>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-2">
            Encrypted backup contains your AES-GCM encrypted secrets — safe to store anywhere. Restore it on any device with your ShadowKey password.
          </p>
        </div>

        {lockdownHistory.length > 0 && (
          <div className="bg-white dark:bg-slate-900/60 border border-rose-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-rose-500 dark:text-rose-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Lockdown History</h2>
            </div>
            <div className="space-y-2">
              {lockdownHistory.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 dark:bg-slate-800/40 border border-sky-200 dark:border-slate-700/40 text-xs">
                  <div>
                    <p className="text-slate-700 dark:text-slate-300 mb-0.5">
                      {new Date(event.triggered_at).toLocaleString()} -- {event.reason}
                    </p>
                    <p className="text-slate-500 dark:text-slate-600">
                      {event.policies_revoked} policies, {event.personas_deactivated} personas affected
                    </p>
                  </div>
                  {event.restored_at ? (
                    <span className="text-emerald-500 dark:text-emerald-400 text-xs">Restored</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkRestored(event.id)}
                      loading={restoringId === event.id}
                    >
                      Mark Restored
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900/60 border border-rose-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-rose-500 dark:text-rose-400" />
            <h2 className="text-sm font-semibold text-rose-500 dark:text-rose-300">Danger Zone</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">Revoke all access</p>
                <p className="text-xs text-slate-500 dark:text-slate-600">Deactivate all policies, personas, and pending requests</p>
              </div>
              {confirmRevoke ? (
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={handleRevokeAll} loading={revoking}>Confirm</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmRevoke(true)}>
                  <Trash2 size={12} /> Revoke All
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">Lock vault</p>
                <p className="text-xs text-slate-500 dark:text-slate-600">Disconnect wallet and clear session. Secrets remain encrypted on server.</p>
              </div>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={handleLockVault}>Lock Now</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Zap size={12} /> Lock Vault
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-amber-500 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-300">Demo Mode</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed">
            Smart contract interactions are simulated against Supabase with server-side enforcement via
            Edge Functions and Postgres RPC. For production, replace the Supabase service layer with
            real ethers.js calls against a deployed ShadowVault.sol contract on Base Mainnet.
          </p>
        </div>
      </div>
    </div>
  );
}
