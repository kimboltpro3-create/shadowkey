import { BrowserProvider, Contract, AbiCoder, keccak256, toUtf8Bytes, JsonRpcProvider, solidityPackedKeccak256 } from 'ethers';
import { supabase } from './supabase';

// EAS is predeployed on all OP Stack chains (Base, Base Sepolia) at this address
const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';
const BASE_MAINNET_RPC = 'https://mainnet.base.org';

/** Read-only provider for Base Mainnet — no wallet required. */
export function getReadOnlyEASProvider() {
  return new JsonRpcProvider(BASE_MAINNET_RPC);
}

export interface PublicAttestation {
  id: string;
  eas_uid: string | null;
  tx_hash: string;
  agent_name: string;
  category: string;
  approved_count: number;
  denied_count: number;
  purpose: string | null;
  basescan_url: string | null;
  created_at: string;
}

/** Fetch recent ShadowKey attestations from Supabase public_attestations table. */
export async function fetchRecentAttestations(limit = 20): Promise<PublicAttestation[]> {
  const { data, error } = await supabase
    .from('public_attestations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as PublicAttestation[];
}

/** Store an attestation record in the public explorer table. */
export async function storePublicAttestation(params: {
  easUid: string;
  txHash: string;
  agentName: string;
  category: string;
  approvedCount: number;
  deniedCount: number;
  purpose: string;
  chainId?: number;
}): Promise<void> {
  const base = params.chainId === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org';
  const basescanUrl = `${base}/tx/${params.txHash}`;
  await supabase.from('public_attestations').insert({
    eas_uid: params.easUid,
    tx_hash: params.txHash,
    agent_name: params.agentName,
    category: params.category,
    approved_count: params.approvedCount,
    denied_count: params.deniedCount,
    purpose: params.purpose,
    basescan_url: basescanUrl,
  });
}
const SCHEMA_REGISTRY_ADDRESS = '0x4200000000000000000000000000000000000020';

// Minimal EAS ABI — only the attest function we need
const EAS_ABI = [
  'function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data)) external payable returns (bytes32)',
  'function getAttestation(bytes32 uid) external view returns ((bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))',
];

const SCHEMA_REGISTRY_ABI = [
  'function register(string schema, address resolver, bool revocable) external returns (bytes32)',
];

// Our attestation schema: proves authorized access without revealing data values
// Schema: "bytes32 disclosureId, string agentName, string category, string[] approvedFields, string[] deniedFields, string purpose, uint256 timestamp"
// This is registered once, then reused for all attestations
const SCHEMA_STRING = 'bytes32 disclosureId,string agentName,string category,string[] approvedFields,string[] deniedFields,string purpose,uint256 timestamp';

// Pre-registered schema UID (will be set after first registration)
let registeredSchemaUID: string | null = null;

async function getProvider() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('MetaMask not available');
  return new BrowserProvider(ethereum);
}

/**
 * Register the ShadowKey disclosure schema on EAS (one-time operation).
 * Returns the schema UID.
 */
/**
 * Compute the schema UID deterministically — same formula as SchemaRegistry._getUID():
 *   keccak256(abi.encodePacked(schema, resolver, revocable))
 * No transaction needed. Works on any chain where the schema is registered.
 */
function computeSchemaUID(): string {
  return solidityPackedKeccak256(
    ['string', 'address', 'bool'],
    [SCHEMA_STRING, '0x0000000000000000000000000000000000000000', true]
  );
}

export async function registerSchema(_isTestnet = false): Promise<string> {
  if (registeredSchemaUID) return registeredSchemaUID;
  registeredSchemaUID = computeSchemaUID();
  return registeredSchemaUID;
}

/**
 * Create an on-chain EAS attestation for an authorized disclosure.
 * Proves that specific fields were authorized without revealing data values.
 */
export async function createDisclosureAttestation(params: {
  disclosureId: string;
  agentName: string;
  category: string;
  approvedFields: string[];
  deniedFields: string[];
  purpose: string;
  schemaUID: string;
}): Promise<{ attestationUID: string; txHash: string }> {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const eas = new Contract(EAS_CONTRACT_ADDRESS, EAS_ABI, signer);

  // Encode attestation data
  const abiCoder = AbiCoder.defaultAbiCoder();
  const encodedData = abiCoder.encode(
    ['bytes32', 'string', 'string', 'string[]', 'string[]', 'string', 'uint256'],
    [
      keccak256(toUtf8Bytes(params.disclosureId)),
      params.agentName,
      params.category,
      params.approvedFields,
      params.deniedFields,
      params.purpose,
      BigInt(Math.floor(Date.now() / 1000)),
    ]
  );

  const attestationRequest = {
    schema: params.schemaUID,
    data: {
      recipient: '0x0000000000000000000000000000000000000000',
      expirationTime: BigInt(0), // no expiration
      revocable: true,
      refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data: encodedData,
      value: BigInt(0),
    },
  };

  const tx = await eas.attest(attestationRequest);
  const receipt = await tx.wait();

  // Attestation UID is in the event logs
  // EAS Attested event: Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 schema)
  // topics[1] = recipient (zero address — not the UID)
  // data = abi.encode(uid, schema) → first 32 bytes is the UID
  const attestationUID = receipt.logs[0]?.data?.slice(0, 66) || '';

  return {
    attestationUID,
    txHash: tx.hash,
  };
}

/**
 * Read an existing attestation from EAS
 */
export async function getAttestation(uid: string) {
  const provider = await getProvider();
  const eas = new Contract(EAS_CONTRACT_ADDRESS, EAS_ABI, provider);
  return eas.getAttestation(uid);
}

/**
 * Check if EAS is available (MetaMask connected to Base)
 */
export function isEASAvailable(): boolean {
  return !!(window as any).ethereum;
}

/**
 * Get EAS scan URL for an attestation
 */
export function getEASScanUrl(attestationUID: string, chainId: number = 84532): string {
  const base = chainId === 84532
    ? 'https://base-sepolia.easscan.org'
    : 'https://base.easscan.org';
  return `${base}/attestation/view/${attestationUID}`;
}

/**
 * Get Basescan URL for the attestation transaction
 */
export function getAttestationBasescanUrl(txHash: string, chainId: number = 84532): string {
  const base = chainId === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org';
  return `${base}/tx/${txHash}`;
}
