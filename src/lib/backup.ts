// ─── Vault Backup & Restore ───────────────────────────────────────────────────
//
// Exports an encrypted vault backup to a JSON file that can be re-imported
// on any device. The secrets are already AES-GCM encrypted in Supabase, so
// the backup file is safe to store anywhere — only the original wallet
// signature can decrypt it.
//
// Supports both Supabase-backed vaults and Local Mode vaults (localStorage).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export interface VaultBackup {
  version: 2;
  vaultId: string;
  exportedAt: string;
  mode: 'supabase' | 'local';
  hint: string;
  secrets: Array<{
    id: string;
    category: string;
    label: string;
    ciphertext: string;
    iv: string;
    salt: string;
    created_at: string;
  }>;
}

/**
 * Export all encrypted secrets from a Supabase-backed vault to a JSON file.
 * Data stays AES-GCM encrypted — only decryptable with the wallet signature.
 */
export async function exportVault(vaultId: string): Promise<void> {
  const { data, error } = await supabase
    .from('encrypted_secrets')
    .select('id, category, label, ciphertext, iv, salt, created_at')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to load secrets: ${error.message}`);

  const backup: VaultBackup = {
    version: 2,
    vaultId,
    exportedAt: new Date().toISOString(),
    mode: 'supabase',
    hint: 'Decrypt with your ShadowKey wallet signature. Store this file securely.',
    secrets: (data || []) as VaultBackup['secrets'],
  };

  _downloadBackup(backup);
}

/**
 * Export all encrypted secrets from a Local Mode vault (localStorage) to JSON.
 */
export function exportLocalVault(ownerAddress: string): void {
  const key = `shadowkey_local_${ownerAddress.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  const store = raw ? JSON.parse(raw) : { secrets: [], vaultId: ownerAddress };

  const backup: VaultBackup = {
    version: 2,
    vaultId: store.vaultId || ownerAddress,
    exportedAt: new Date().toISOString(),
    mode: 'local',
    hint: 'Decrypt with your ShadowKey wallet signature. Store this file securely.',
    secrets: store.secrets || [],
  };

  _downloadBackup(backup);
}

function _downloadBackup(backup: VaultBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shadowkey-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a backup file into a Supabase vault.
 * Existing secrets with the same label+category are skipped.
 */
export async function importVault(
  file: File,
  targetVaultId: string,
): Promise<{ restored: number; skipped: number }> {
  const backup = await _parseBackup(file);

  const { data: existing } = await supabase
    .from('encrypted_secrets')
    .select('label, category')
    .eq('vault_id', targetVaultId);

  const existingKeys = new Set((existing || []).map((s) => `${s.category}:${s.label}`));
  const toInsert = backup.secrets.filter((s) => !existingKeys.has(`${s.category}:${s.label}`));

  if (toInsert.length === 0) return { restored: 0, skipped: backup.secrets.length };

  const { error } = await supabase.from('encrypted_secrets').insert(
    toInsert.map((s) => ({ ...s, id: undefined, vault_id: targetVaultId }))
  );

  if (error) throw new Error(`Restore failed: ${error.message}`);

  return { restored: toInsert.length, skipped: backup.secrets.length - toInsert.length };
}

/**
 * Import a backup file into Local Mode storage (localStorage).
 */
export async function importVaultLocal(
  file: File,
  ownerAddress: string,
): Promise<{ restored: number; skipped: number }> {
  const backup = await _parseBackup(file);
  const key = `shadowkey_local_${ownerAddress.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  const store = raw ? JSON.parse(raw) : { secrets: [], vaultId: ownerAddress };

  const existingKeys = new Set(
    (store.secrets || []).map((s: { category: string; label: string }) => `${s.category}:${s.label}`)
  );
  const toInsert = backup.secrets.filter((s) => !existingKeys.has(`${s.category}:${s.label}`));

  store.secrets = [...(store.secrets || []), ...toInsert.map((s) => ({ ...s, id: crypto.randomUUID() }))];
  localStorage.setItem(key, JSON.stringify(store));

  return { restored: toInsert.length, skipped: backup.secrets.length - toInsert.length };
}

async function _parseBackup(file: File): Promise<VaultBackup> {
  const text = await file.text();
  let backup: VaultBackup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('Invalid backup file — could not parse JSON.');
  }
  if (!Array.isArray(backup.secrets)) throw new Error('Invalid backup file format.');
  // Support both v1 (encrypted_value) and v2 (ciphertext) field names
  backup.secrets = backup.secrets.map((s: any) => ({
    ...s,
    ciphertext: s.ciphertext ?? s.encrypted_value ?? '',
  }));
  return backup;
}
