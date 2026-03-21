import { verifyMessage } from 'ethers';
import { supabase } from './supabase';
import type { ConsentReceipt, SecretCategory } from '../types';

export async function generateReceiptHash(
  fields: string[],
  policyId: string | null,
  agentAddress: string,
  serviceAddress: string,
  category: SecretCategory,
  amount: number | null,
  timestamp: string,
  vaultId: string
): Promise<string> {
  const payload = JSON.stringify({
    vault_id: vaultId,
    fields: fields.sort(),
    policy_id: policyId,
    agent_address: agentAddress.toLowerCase(),
    service_address: serviceAddress.toLowerCase(),
    category,
    amount,
    timestamp,
  });
  const encoded = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signReceipt(
  receiptHash: string,
  walletAddress: string
): Promise<{ signature: string; isDemoSignature: boolean }> {
  const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!ethereum) {
    const bytes = crypto.getRandomValues(new Uint8Array(65));
    return {
      signature: '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''),
      isDemoSignature: true,
    };
  }
  const signature = await ethereum.request({
    method: 'personal_sign',
    params: [`ShadowKey Consent Receipt\nHash: ${receiptHash}`, walletAddress],
  });
  return {
    signature: signature as string,
    isDemoSignature: false,
  };
}

export async function storeConsentReceipt(
  vaultId: string,
  receipt: Omit<ConsentReceipt, 'id' | 'created_at'>
): Promise<ConsentReceipt> {
  const { data, error } = await supabase
    .from('consent_receipts')
    .insert({
      vault_id: vaultId,
      disclosure_log_id: receipt.disclosure_log_id,
      receipt_hash: receipt.receipt_hash,
      wallet_signature: receipt.wallet_signature,
      signer_address: receipt.signer_address.toLowerCase(),
      policy_id: receipt.policy_id,
      agent_address: receipt.agent_address.toLowerCase(),
      service_address: receipt.service_address.toLowerCase(),
      category: receipt.category,
      fields_disclosed: receipt.fields_disclosed,
      amount: receipt.amount,
      is_demo_signature: receipt.is_demo_signature,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to store receipt: ${error.message}`);
  return data;
}

export async function loadConsentReceipts(vaultId: string): Promise<ConsentReceipt[]> {
  const { data, error } = await supabase
    .from('consent_receipts')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load receipts: ${error.message}`);
  return data || [];
}

export async function verifyReceiptSignature(
  receiptHash: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    const message = `ShadowKey Consent Receipt\nHash: ${receiptHash}`;
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

export async function createReceiptForDisclosure(
  vaultId: string,
  walletAddress: string,
  disclosureLogId: string,
  policyId: string | null,
  agentAddress: string,
  serviceAddress: string,
  category: SecretCategory,
  fieldsDisclosed: string[],
  amount: number | null
): Promise<ConsentReceipt> {
  const timestamp = new Date().toISOString();
  const receiptHash = await generateReceiptHash(
    fieldsDisclosed,
    policyId,
    agentAddress,
    serviceAddress,
    category,
    amount,
    timestamp,
    vaultId
  );
  const { signature, isDemoSignature } = await signReceipt(receiptHash, walletAddress);
  return storeConsentReceipt(vaultId, {
    vault_id: vaultId,
    disclosure_log_id: disclosureLogId,
    receipt_hash: receiptHash,
    wallet_signature: signature,
    signer_address: walletAddress,
    policy_id: policyId,
    agent_address: agentAddress,
    service_address: serviceAddress,
    category,
    fields_disclosed: fieldsDisclosed,
    amount,
    is_demo_signature: isDemoSignature,
  });
}
