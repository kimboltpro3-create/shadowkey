// ─── On-Chain Fallback for Disclosure Confirmation ───────────────────────────
//
// When Supabase is unavailable, the SDK can fall back to watching the Base
// Mainnet chain directly for evidence of approved disclosures.
//
// Two signals are used:
//   1. EAS `Attested` events — each approved disclosure creates an on-chain
//      attestation via the Ethereum Attestation Service. This is independently
//      detectable without any centralised server.
//   2. ShadowVault `DisclosureLogged` events — emitted when logDisclosure()
//      is called on the contract after a policy-based approval.
//
// This module provides a read-only chain watcher (no wallet required) that
// polls Base Mainnet via a public JSON-RPC endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import { JsonRpcProvider, Contract, Interface } from 'ethers';

const RPC_URL = 'https://mainnet.base.org';
const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';

// Minimal ABI — only the events we need
const EAS_EVENTS_ABI = [
  'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)',
];

const VAULT_EVENTS_ABI = [
  'event DisclosureLogged(bytes32 indexed policyId, address indexed agentAddress, address indexed serviceAddress, uint8 category, uint96 amount, bytes32 detailsHash, uint256 timestamp)',
];

export interface FallbackEvent {
  type: 'eas_attestation' | 'vault_disclosure' | 'block';
  data: Record<string, string | number>;
}

export interface ChainWatcherHandle {
  stop: () => void;
}

/**
 * Start watching Base Mainnet for on-chain disclosure confirmations.
 * No wallet or MetaMask required — uses a read-only public RPC.
 *
 * @param vaultAddress  ShadowVault contract address
 * @param onEvent       Called on each relevant chain event
 * @param onBlock       Called on each new block (for liveness indicator)
 */
export function startChainFallbackWatcher(
  vaultAddress: string,
  onEvent: (event: FallbackEvent) => void,
  onBlock: (blockNumber: number) => void,
): ChainWatcherHandle {
  const provider = new JsonRpcProvider(RPC_URL);
  const easIface = new Interface(EAS_EVENTS_ABI);
  const vaultIface = new Interface(VAULT_EVENTS_ABI);

  const easContract = new Contract(EAS_ADDRESS, easIface, provider);
  const vaultContract = new Contract(vaultAddress, vaultIface, provider);

  // Listen for EAS attestation events (proof of approved disclosures)
  const handleAttestation = (
    recipient: string,
    attester: string,
    uid: string,
    schemaUID: string,
  ) => {
    onEvent({
      type: 'eas_attestation',
      data: { uid: uid.slice(0, 18) + '...', attester, schemaUID: schemaUID.slice(0, 10) + '...' },
    });
  };

  // Listen for ShadowVault disclosure events (policy-based approvals)
  const handleDisclosure = (
    policyId: string,
    agentAddress: string,
    _serviceAddress: string,
    category: number,
    _amount: bigint,
    detailsHash: string,
    timestamp: bigint,
  ) => {
    onEvent({
      type: 'vault_disclosure',
      data: {
        policyId: policyId.slice(0, 10) + '...',
        agentAddress: agentAddress.slice(0, 10) + '...',
        category,
        detailsHash: detailsHash.slice(0, 10) + '...',
        timestamp: Number(timestamp),
      },
    });
  };

  easContract.on('Attested', handleAttestation);
  vaultContract.on('DisclosureLogged', handleDisclosure);
  provider.on('block', onBlock);

  return {
    stop: () => {
      try {
        easContract.off('Attested', handleAttestation);
        vaultContract.off('DisclosureLogged', handleDisclosure);
        provider.off('block', onBlock);
        provider.destroy();
      } catch { /* cleanup is best-effort */ }
    },
  };
}
