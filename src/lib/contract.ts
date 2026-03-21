import { BrowserProvider, Contract, keccak256, toUtf8Bytes, AbiCoder } from 'ethers';
import type { SecretCategory } from '../types';
import SHADOW_VAULT_ABI from './ShadowVaultABI.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_SHADOW_VAULT_ADDRESS || '';
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '84532');

const CATEGORY_TO_INDEX: Record<SecretCategory, number> = {
  payment: 0, identity: 1, credentials: 2, health: 3, preferences: 4,
};

export function categoryToSolidity(cat: SecretCategory): number {
  return CATEGORY_TO_INDEX[cat];
}

export function uuidToBytes32(uuid: string): string {
  return keccak256(toUtf8Bytes(uuid));
}

export function hashPolicyDetails(
  allowedServices: string[],
  revealFields: string[],
  hiddenFields: string[]
): string {
  const abiCoder = AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['string[]', 'string[]', 'string[]'],
    [allowedServices, revealFields, hiddenFields]
  );
  return keccak256(encoded);
}

export function dollarsToCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

export function isContractAvailable(): boolean {
  return !!(window as any).ethereum && !!CONTRACT_ADDRESS;
}

async function getSignerAndContract(): Promise<{ contract: Contract; address: string }> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('MetaMask not available');

  const provider = new BrowserProvider(ethereum);
  const network = await provider.getNetwork();

  if (Number(network.chainId) !== CHAIN_ID) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + CHAIN_ID.toString(16) }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + CHAIN_ID.toString(16),
            chainName: CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [CHAIN_ID === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org'],
            blockExplorerUrls: [CHAIN_ID === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'],
          }],
        });
      } else {
        throw switchError;
      }
    }
  }

  const signer = await provider.getSigner();
  const contract = new Contract(CONTRACT_ADDRESS, SHADOW_VAULT_ABI, signer);
  return { contract, address: await signer.getAddress() };
}

// ─── Write Functions ─────────────────────────────────────────

export async function registerPolicyOnChain(
  supabaseId: string,
  agentAddress: string,
  category: SecretCategory,
  spendLimit: number,
  totalLimit: number,
  expiresAt: Date,
  allowedServices: string[],
  revealFields: string[],
  hiddenFields: string[]
): Promise<string> {
  const { contract } = await getSignerAndContract();
  const policyId = uuidToBytes32(supabaseId);
  const detailsHash = hashPolicyDetails(allowedServices, revealFields, hiddenFields);

  const tx = await contract.registerPolicy(
    policyId,
    agentAddress,
    categoryToSolidity(category),
    dollarsToCents(spendLimit),
    dollarsToCents(totalLimit),
    BigInt(Math.floor(expiresAt.getTime() / 1000)),
    detailsHash
  );
  await tx.wait();
  return tx.hash;
}

export async function revokePolicyOnChain(supabaseId: string): Promise<string> {
  const { contract } = await getSignerAndContract();
  const tx = await contract.revokePolicy(uuidToBytes32(supabaseId));
  await tx.wait();
  return tx.hash;
}

export async function logDisclosureOnChain(
  policySupabaseId: string,
  serviceAddress: string,
  amount: number,
  encryptedDetailsHash: string
): Promise<string> {
  const { contract } = await getSignerAndContract();
  const tx = await contract.logDisclosure(
    uuidToBytes32(policySupabaseId),
    serviceAddress,
    dollarsToCents(amount),
    keccak256(toUtf8Bytes(encryptedDetailsHash))
  );
  await tx.wait();
  return tx.hash;
}

export async function updateBudgetOnChain(
  category: SecretCategory,
  maxDisclosuresPerDay: number,
  maxDisclosuresPerWeek: number,
  maxUniqueServices: number,
  maxSpendPerDay: number,
  alertThresholdPct: number
): Promise<string> {
  const { contract } = await getSignerAndContract();
  const tx = await contract.updateBudget(
    categoryToSolidity(category),
    maxDisclosuresPerDay,
    maxDisclosuresPerWeek,
    maxUniqueServices,
    dollarsToCents(maxSpendPerDay),
    alertThresholdPct
  );
  await tx.wait();
  return tx.hash;
}

export async function emergencyLockdownOnChain(reason: string): Promise<string> {
  const { contract } = await getSignerAndContract();
  const tx = await contract.emergencyLockdown(reason);
  await tx.wait();
  return tx.hash;
}

export async function liftLockdownOnChain(): Promise<string> {
  const { contract } = await getSignerAndContract();
  const tx = await contract.liftLockdown();
  await tx.wait();
  return tx.hash;
}

// ─── Read Functions ──────────────────────────────────────────

export async function isContractLockedDown(): Promise<boolean> {
  const { contract } = await getSignerAndContract();
  return contract.isLockedDown();
}

export async function getOnChainPolicyCount(): Promise<number> {
  const { contract } = await getSignerAndContract();
  const count = await contract.getPolicyCount();
  return Number(count);
}

export function getBasescanUrl(txHash: string): string {
  const base = CHAIN_ID === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org';
  return `${base}/tx/${txHash}`;
}

export function getChainName(): string {
  return CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base Mainnet';
}
