# ShadowKey × Slice

**Tracks:** ERC-8128 Agent Authentication · Future of Commerce · Product Hooks
**Prize Pool:** $500 (ERC-8128) + $750 (Future of Commerce) + $700 (Product Hooks)
**Sponsor:** Slice — [slice.so](https://slice.so)

---

## Overview

ShadowKey enters all three Slice tracks by combining privacy-preserving vault access, RFC 9421 HTTP message signatures, and a Solidity product hook into a single end-to-end agent checkout flow:

```
Vault Owner sets policies
        │
AI Agent requests scoped vault access (ShadowKey SDK)
        │
Vault Owner approves per-field
        │
Agent builds ERC-8128 signed checkout request (no API key)
        │
SliceShadowKeyGate.isPurchaseAllowed() — trust score ≥ 70 required
        │
Slice executes purchase
        │
SliceShadowKeyGate.onProductPurchase() — emits PrivacyPreservedPurchase receipt
```

---

## Track 1 — ERC-8128 Agent Authentication ($500)

**Implementation:** [`sdk/src/erc8128.ts`](../sdk/src/erc8128.ts)
**SDK Client:** [`sdk/src/erc8128Client.ts`](../sdk/src/erc8128Client.ts)
**Demo:** [shadowkey-ai.vercel.app/erc8128](https://shadowkey-ai.vercel.app/erc8128)

### What is ERC-8128?

ERC-8128 is RFC 9421 HTTP Message Signatures adapted for Ethereum. Every HTTP request from an agent is cryptographically signed with the agent's Ethereum private key. The server verifies via `ecrecover` — no stored secrets, no sessions, no API keys.

**SIWE vs ERC-8128:**

| | SIWE | ERC-8128 |
|--|------|----------|
| **When signed** | Once at login | Every request |
| **Credential** | Session token (server-stored) | Signature (stateless) |
| **Replay attack** | Session expiry only | Nonce + 5-min timestamp window |
| **If stolen** | Full session compromise | Single request only |
| **Server state** | Session store required | None — pure verification |

### Three Headers Per Request

```
Content-Digest: sha-256=:<base64(SHA-256(body))>:
Signature-Input: sig1=("@method" "@path" "@authority" "content-digest");created=1742000000;nonce="a3f8c1d2";keyid="0xAgentAddr"
Signature: sig1=:<base64(ethers.personal_sign(signatureBase))>:
```

### Usage

```typescript
import { ERC8128ShadowKeyClient } from 'shadowkey-agent-sdk';
import { ethers } from 'ethers';

const wallet = new ethers.Wallet(PRIVATE_KEY);

const client = new ERC8128ShadowKeyClient({
  apiUrl: 'https://your-api.supabase.co/functions/v1',
  signerConfig: {
    address: wallet.address,
    sign: (msg) => wallet.signMessage(msg),
  },
});

// Every request is signed — no API key needed
await client.requestAccess({
  agentId: 'slice-agent-001',
  requestedFields: ['billing_name', 'shipping_address', 'card_last4'],
  purpose: 'Complete Slice checkout',
  category: 'payment',
});
```

### Raw Primitives

```typescript
import { signRequest, verifyRequest, computeContentDigest } from 'shadowkey-agent-sdk';

// Sign (agent side)
const headers = await signRequest(signerConfig, { method: 'POST', url, body });

// Verify (server side) — returns recovered address
const recoveredAddress = await verifyRequest({
  method: 'POST', url,
  signatureInput: headers['Signature-Input'],
  signature: headers['Signature'],
  contentDigest: headers['Content-Digest'],
});
// Throws if: timestamp > 5 min old, nonce reused, body tampered
```

### Implementation Details

- **No new dependencies** — uses `globalThis.crypto.subtle` (same as existing HMAC signing)
- **Dynamic `import('ethers')`** — works in both Vite (browser) and Node.js
- **Covered components:** `@method`, `@path`, `@authority`, `content-digest` (for POST)
- **Signature base:** RFC 9421 format — each component on its own line, `@signature-params` last
- **Freshness window:** 5 minutes — rejects stale signatures (prevents replay attacks)

---

## Track 2 — Future of Commerce ($750)

**Demo:** [shadowkey-ai.vercel.app/slice](https://shadowkey-ai.vercel.app/slice)
**Page:** [`src/pages/SliceCheckoutPage.tsx`](../src/pages/SliceCheckoutPage.tsx)

### The Problem with E-Commerce Today

Every online checkout requires:
1. Typing your card number into a merchant's form (stored in their DB)
2. Trusting the merchant's security posture
3. Manually filling the same fields on every site

For AI agents shopping on your behalf, it's worse — you'd have to give the agent your full card details, which it might pass to any service.

### ShadowKey's Solution: Field-Level Vault Checkout

```
Traditional checkout:
  You → paste card number → Merchant (stores it)

ShadowKey checkout:
  Agent → requestAccess(['card_last4', 'shipping_address']) → You approve
  Merchant receives only approved fields — card number never leaves the vault
  Revoke access anytime in your ShadowKey dashboard
```

### Demo Walkthrough (live at `/slice`)

1. **Agent initializes** → requests 4 checkout fields from vault
2. **Vault approval panel** → owner sees each field encrypted, chooses:
   - Approve All (reveal all 4)
   - Approve Partial (hide email)
   - Deny (agent cannot proceed)
3. **ERC-8128 signing** → agent builds wallet-signed checkout request; headers displayed in monospace
4. **Trust gate check** → `SliceShadowKeyGate.isPurchaseAllowed()` — ShoppingAgent (score 85) → TRUSTED ✓
5. **Order complete** → `onProductPurchase()` emits `PrivacyPreservedPurchase` on-chain

### Why This is the "Future of Commerce"

- **Users never paste card details** — vault holds them; only the last 4 digits are ever shared
- **Non-crypto-native experience** — vault owner sees a clean React approval UI, no gas/wallet needed
- **Revocable consent** — one click in ShadowKey dashboard revokes the agent's access
- **Auditable** — every field disclosure creates an immutable on-chain record
- **Agent-native** — built for the world where AI agents shop on your behalf

---

## Track 3 — Product Hooks ($700)

**Contract:** [`contracts/SliceShadowKeyGate.sol`](../contracts/SliceShadowKeyGate.sol)
**Deploy Script:** [`scripts/deploySliceGate.cjs`](../scripts/deploySliceGate.cjs)
**Network:** Base Sepolia (Chain ID: 84532)

### IProductAction Implementation

`SliceShadowKeyGate.sol` implements the Slice `IProductAction` interface:

```solidity
// Gate: only ShadowKey-trusted agents (score >= 70) can purchase
function isPurchaseAllowed(
    uint256 productId,
    uint32  quantity,
    address buyer,
    bytes   calldata data
) external view returns (bool) {
    if (productExempt[productId]) return true;  // per-product override
    return agentRecords[buyer].trusted;           // trust score >= 70
}

// Post-purchase: emit immutable consent receipt
function onProductPurchase(
    uint256 productId,
    uint32  quantity,
    address buyer,
    bytes   calldata data
) external returns (bytes memory) {
    emit PrivacyPreservedPurchase(buyer, productId, quantity,
        agentRecords[buyer].trustScore, uint64(block.timestamp));
    return abi.encode(purchaseCount, agentRecords[buyer].trustScore, block.timestamp);
}
```

### Agent Trust Registry

The hook maintains a local trust registry synced from ShadowKey's reputation engine:

```solidity
// Sync a single agent (called by ShadowKey operator after Status Network attestation)
function setAgentTrust(address agent, uint8 trustScore) external onlyOwner

// Gas-efficient batch sync
function setAgentTrustBatch(address[] calldata agents, uint8[] calldata scores) external onlyOwner
```

**Sync flow:**
1. ShadowKey reputation engine computes trust scores off-chain (from Supabase)
2. `gaslessAttest.cjs` attests them on Status Network Sepolia (gasPrice=0)
3. `setAgentTrustBatch()` syncs the same scores to `SliceShadowKeyGate.sol` on Base
4. Slice calls `isPurchaseAllowed()` on every checkout → trusted agents pass, others blocked

> **V2 roadmap:** Automate sync via cross-chain message (bridge / LayerZero / CCIP) so Status Network attestations automatically propagate to Base.

### Events

```solidity
// Emitted on every gated purchase — on-chain consent receipt
event PrivacyPreservedPurchase(
    address indexed buyer,
    uint256 indexed productId,
    uint32  quantity,
    uint8   trustScore,
    uint64  timestamp
);

// Emitted when agent trust is updated
event AgentTrustUpdated(address indexed agent, uint8 trustScore, bool trusted, uint64 attestedAt);
```

### Demo Agent Trust State

| Agent | Score | Status on Hook |
|-------|-------|----------------|
| ShoppingAgent (`0x1111…`) | 85 | TRUSTED ✓ — can purchase |
| TravelAgent (`0x2222…`) | 62 | BLOCKED ✗ — below threshold |
| ResearchAgent (`0x3333…`) | 12 | BLOCKED ✗ — below threshold |

### Deploy & Seed

```bash
# Compile
npm run compile

# Deploy to Base Sepolia (seeds demo agent trust records automatically)
npm run deploy:slice-gate

# Output:
# SliceShadowKeyGate deployed to: 0x...
# ShoppingAgent (85) → TRUSTED ✓
# TravelAgent (62) → BLOCKED ✗
# ResearchAgent (12) → BLOCKED ✗
```

---

## Files Summary

| File | Track | Purpose |
|------|-------|---------|
| [`sdk/src/erc8128.ts`](../sdk/src/erc8128.ts) | ERC-8128 | Core RFC 9421 implementation |
| [`sdk/src/erc8128Client.ts`](../sdk/src/erc8128Client.ts) | ERC-8128 | `ERC8128ShadowKeyClient` class |
| [`sdk/src/index.ts`](../sdk/src/index.ts) | ERC-8128 | Exports `signRequest`, `verifyRequest`, etc. |
| [`src/pages/ERC8128DemoPage.tsx`](../src/pages/ERC8128DemoPage.tsx) | ERC-8128 | Live MetaMask signing demo |
| [`src/pages/SliceCheckoutPage.tsx`](../src/pages/SliceCheckoutPage.tsx) | FoC + Hooks | Full agent checkout demo |
| [`contracts/SliceShadowKeyGate.sol`](../contracts/SliceShadowKeyGate.sol) | Hooks | IProductAction implementation |
| [`scripts/deploySliceGate.cjs`](../scripts/deploySliceGate.cjs) | Hooks | Deploy + seed script |

---

## How the Three Tracks Connect

```
ERC-8128 Track          Future of Commerce Track       Product Hooks Track
─────────────           ──────────────────────         ──────────────────
sdk/erc8128.ts          SliceCheckoutPage.tsx          SliceShadowKeyGate.sol
     │                           │                              │
     │   Agent signs request     │   User approves fields       │  Contract gates
     │   with Ethereum key ──────┼──────────────────────────────┼─ purchase by
     │   (no API key needed)     │   Agent submits signed       │  trust score
     └───────────────────────────┘   checkout to Slice ─────────┘
```

All three tracks are demonstrated in the single `/slice` demo page.
