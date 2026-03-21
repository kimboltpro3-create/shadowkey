// ─── Pinata IPFS Pinning ─────────────────────────────────────────────────────
//
// Pins disclosure metadata to IPFS via Pinata's free API (2 GB, no credit card).
// Get a JWT at https://app.pinata.cloud — add it as VITE_PINATA_JWT in .env.local
//
// Why: After an EAS on-chain attestation, the raw disclosure metadata is also
// pinned to IPFS/Filecoin so it is independently verifiable without trusting
// any server (addresses the Supabase centralisation concern).
//
// ─────────────────────────────────────────────────────────────────────────────

export interface DisclosureMetadata {
  disclosureId: string;
  agentName: string;
  category: string;
  approvedFields: string[];
  deniedFields: string[];
  purpose: string;
  easAttestationUID?: string;
  easTxHash?: string;
  timestamp: string;
}

export interface PinResult {
  cid: string;
  gatewayUrl: string;
}

/**
 * Pins disclosure metadata JSON to IPFS via Pinata.
 * Returns the IPFS CID and a public gateway URL.
 *
 * Requires VITE_PINATA_JWT env var (free at app.pinata.cloud).
 * Falls through silently if the JWT is absent — IPFS is additive, not critical.
 */
export async function pinDisclosureToIPFS(
  metadata: DisclosureMetadata,
  pinataJwt: string,
): Promise<PinResult> {
  const body = {
    pinataContent: metadata,
    pinataMetadata: {
      name: `shadowkey-disclosure-${metadata.disclosureId.slice(0, 8)}`,
      keyvalues: {
        agentName: metadata.agentName,
        category: metadata.category,
        disclosureId: metadata.disclosureId,
      },
    },
  };

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Pinata error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const cid: string = data.IpfsHash;
  return {
    cid,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
  };
}
