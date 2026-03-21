// ─── Local Mode Vault ─────────────────────────────────────────────────────────
//
// When isLocalMode is true, all vault data is stored in localStorage
// (still AES-GCM encrypted with the wallet signature as the key).
// No Supabase required — works fully offline.
//
// This directly addresses the centralisation concern: users who distrust
// a cloud provider can store their encrypted vault in their own browser.
// ─────────────────────────────────────────────────────────────────────────────

import { encryptData } from './crypto';
import type { VaultSecret, Policy, DisclosureLog } from '../types';

const LOCAL_VAULT_KEY = (addr: string) => `shadowkey_local_${addr.toLowerCase()}`;
const SIZE_WARN_BYTES = 3_500_000; // 3.5 MB — warn before hitting 5 MB iOS Safari limit

interface LocalStore {
  vaultId: string;
  secrets: VaultSecret[];
  policies: Policy[];
  disclosureLogs: DisclosureLog[];
}

function readStore(ownerAddress: string): LocalStore {
  const raw = localStorage.getItem(LOCAL_VAULT_KEY(ownerAddress));
  if (!raw) return { vaultId: '', secrets: [], policies: [], disclosureLogs: [] };
  try { return JSON.parse(raw); } catch { return { vaultId: '', secrets: [], policies: [], disclosureLogs: [] }; }
}

function writeStore(ownerAddress: string, store: LocalStore) {
  const serialised = JSON.stringify(store);
  if (serialised.length > SIZE_WARN_BYTES) {
    console.warn('[ShadowKey] Local vault approaching storage limit. Export a backup.');
  }
  localStorage.setItem(LOCAL_VAULT_KEY(ownerAddress), serialised);
}

/** Create or retrieve the local vault ID (deterministic from wallet address). */
export function localGetOrCreateVault(ownerAddress: string): string {
  const store = readStore(ownerAddress);
  if (store.vaultId) return store.vaultId;
  const id = `local-${ownerAddress.toLowerCase().slice(2, 18)}`;
  writeStore(ownerAddress, { ...store, vaultId: id });
  return id;
}

/** Store an encrypted secret in localStorage. */
export async function localStoreSecret(
  ownerAddress: string,
  vaultId: string,
  category: string,
  label: string,
  fieldsJson: string,
  password: string,
): Promise<VaultSecret> {
  const { ciphertext, iv, salt } = await encryptData(fieldsJson, password);
  const secret: VaultSecret = {
    id: crypto.randomUUID(),
    vault_id: vaultId,
    category: category as VaultSecret['category'],
    label,
    ciphertext,
    iv,
    salt,
    created_at: new Date().toISOString(),
  };
  const store = readStore(ownerAddress);
  store.secrets = [...store.secrets, secret];
  writeStore(ownerAddress, store);
  return secret;
}

/** Load all encrypted secrets from localStorage. */
export function localLoadSecrets(ownerAddress: string): VaultSecret[] {
  return readStore(ownerAddress).secrets;
}

/** Delete a secret from localStorage. */
export function localDeleteSecret(ownerAddress: string, secretId: string) {
  const store = readStore(ownerAddress);
  store.secrets = store.secrets.filter((s) => s.id !== secretId);
  writeStore(ownerAddress, store);
}

/** Save a policy to localStorage. */
export function localCreatePolicy(ownerAddress: string, policy: Policy): Policy {
  const store = readStore(ownerAddress);
  store.policies = [...store.policies, policy];
  writeStore(ownerAddress, store);
  return policy;
}

/** Load all policies from localStorage. */
export function localLoadPolicies(ownerAddress: string): Policy[] {
  return readStore(ownerAddress).policies;
}

/** Revoke a policy in localStorage. */
export function localRevokePolicy(ownerAddress: string, policyId: string) {
  const store = readStore(ownerAddress);
  store.policies = store.policies.map((p) =>
    p.id === policyId ? { ...p, is_active: false } : p
  );
  writeStore(ownerAddress, store);
}

/** Log a disclosure in localStorage. */
export function localLogDisclosure(ownerAddress: string, log: DisclosureLog): DisclosureLog {
  const store = readStore(ownerAddress);
  store.disclosureLogs = [log, ...store.disclosureLogs];
  writeStore(ownerAddress, store);
  return log;
}

/** Load disclosure logs from localStorage. */
export function localLoadDisclosureLogs(ownerAddress: string): DisclosureLog[] {
  return readStore(ownerAddress).disclosureLogs;
}

/** Clear all local vault data (used on disconnect or explicit wipe). */
export function localClearVault(ownerAddress: string) {
  localStorage.removeItem(LOCAL_VAULT_KEY(ownerAddress));
}

/** Return storage usage stats for the local vault. */
export function localVaultStats(ownerAddress: string) {
  const store = readStore(ownerAddress);
  const raw = localStorage.getItem(LOCAL_VAULT_KEY(ownerAddress)) || '';
  return {
    secrets: store.secrets.length,
    policies: store.policies.filter((p) => p.is_active).length,
    disclosures: store.disclosureLogs.length,
    storageBytesUsed: raw.length,
  };
}
