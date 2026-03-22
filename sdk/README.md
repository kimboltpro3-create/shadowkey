# ShadowKey Agent SDK

Official SDK for integrating AI agents with [ShadowKey](https://shadowkey-ai.vercel.app)'s privacy-preserving data vault on Base.

[![npm](https://img.shields.io/npm/v/shadowkey-agent-sdk?style=flat-square&logo=npm&color=CB3837)](https://www.npmjs.com/package/shadowkey-agent-sdk) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE) [![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?style=flat-square&logo=node.js)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-First-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

## Features

- **HMAC-SHA256 Request Signing** — Every request is cryptographically signed to prevent replay attacks
- **Automatic Retry** — Exponential backoff on server errors (skips retries on 4xx client errors)
- **Approval Polling** — Built-in `waitForApproval()` with configurable timeout and interval
- **Node.js 18+ & Browser** — Works in both environments using `globalThis.crypto`
- **TypeScript-First** — Full type definitions included (CJS + ESM + `.d.ts`)
- **Zero Dependencies** — No external deps, minimal bundle size (4.8 KB ESM)
- **Debug Mode** — Logs requests/responses with automatic redaction of sensitive fields

## Installation

```bash
npm install shadowkey-agent-sdk
```

## Quick Start

```typescript
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

const client = new ShadowKeyClient({
  apiUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'sk_your_api_key_here',
  debug: true,
});

// 1. Request access to user's vault data
const response = await client.requestAccess({
  agentId: 'shopping-bot-001',
  agentName: 'Smart Shopping Assistant',
  requestedFields: ['shipping_address', 'billing_name', 'card_last4'],
  purpose: 'Complete purchase of wireless headphones ($89.99)',
  category: 'payment',
});

console.log('Request ID:', response.requestId);
// → User receives notification in their ShadowKey dashboard

// 2. Wait for user to approve/deny (polls every 2s, max 5 min)
const result = await client.waitForApproval(response.requestId);

if (result.status === 'approved') {
  console.log('Scoped access granted:', result.grantedFields);
  console.log('Data:', result.grantedData);
  // → Only the fields the user approved — nothing more
} else {
  console.log('Access denied:', result.message);
}
```

## How It Works

```
Your Agent                    ShadowKey SDK                  User's Vault
    |                              |                              |
    |-- requestAccess() ---------> |                              |
    |                              |-- POST /sdk-access-request ->|
    |                              |     (HMAC-signed)            |
    |                              |<---- requestId, pending -----|
    |<---- requestId --------------|                              |
    |                              |                              |
    |-- waitForApproval() -------> |                              |
    |                              |-- GET /sdk-access-status --> |
    |                              |     (polls every 2s)         |
    |                              |                    User approves fields
    |                              |<---- approved, grantedData --|
    |<---- grantedData ------------|                              |
    |                              |                              |
    | Only approved fields received. Denied fields never leave the vault.
```

## API Reference

### Constructor

```typescript
new ShadowKeyClient(config: ShadowKeyConfig)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | *required* | Supabase project URL + `/functions/v1` |
| `apiKey` | `string` | *required* | API key from ShadowKey Settings page |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `retryAttempts` | `number` | `3` | Max retries on server errors |
| `debug` | `boolean` | `false` | Enable debug logging (redacts sensitive fields) |

### `requestAccess(request): Promise<AccessResponse>`

Request scoped access to a user's vault data. Creates a pending disclosure request that the vault owner must approve.

```typescript
const response = await client.requestAccess({
  agentId: 'my-agent-001',        // Your agent's unique ID
  agentName: 'My AI Assistant',    // Human-readable name (shown to user)
  requestedFields: ['email', 'phone'], // Fields you need
  purpose: 'Send order confirmation',  // Why (shown to user)
  category: 'identity',           // Optional: payment, identity, health, etc.
  expiresIn: 300,                 // Optional: seconds until request expires (default 300)
});
```

### `checkStatus(requestId): Promise<DisclosureStatus>`

Check the current status of an access request.

```typescript
const status = await client.checkStatus(response.requestId);
// status.status → 'pending' | 'approved' | 'denied' | 'expired'
```

### `waitForApproval(requestId, maxWaitMs?, pollIntervalMs?): Promise<AccessResponse>`

Poll for user approval with automatic timeout.

| Param | Default | Description |
|-------|---------|-------------|
| `requestId` | *required* | From `requestAccess()` |
| `maxWaitMs` | `300000` (5 min) | Max time to wait |
| `pollIntervalMs` | `2000` (2s) | Time between polls |

```typescript
const result = await client.waitForApproval(response.requestId, 120000, 3000);
```

### `submitReverseDisclosure(request): Promise<ReverseDisclosureResponse>`

Submit data to a user's vault (reverse data flow — services sending data to users).

```typescript
const receipt = await client.submitReverseDisclosure({
  serviceId: 'acme-corp',
  serviceName: 'Acme Corporation',
  dataOffered: [
    { field: 'loyalty_points', value: '4,250', category: 'preferences' },
    { field: 'member_since', value: '2024-01-15', category: 'identity' },
  ],
  purpose: 'Share your loyalty program data',
});
```

## Integration Examples

Both examples import directly from `shadowkey-agent-sdk`:

### OpenRouter AI Agent (`/examples/openrouter/`)

An AI shopping agent that uses OpenRouter's free models with 4-model automatic failover:

```javascript
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

const shadowKey = new ShadowKeyClient({
  apiUrl: `${process.env.SUPABASE_URL}/functions/v1`,
  apiKey: process.env.SHADOWKEY_API_KEY,
});

// AI determines needed fields → SDK requests access → user approves → AI completes task
```

### Express.js Server (`/examples/node-express/`)

A REST API backend that wraps the SDK for multi-agent architectures:

```javascript
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

const shadowKey = new ShadowKeyClient({ ... });

app.post('/api/request-data', async (req, res) => {
  const response = await shadowKey.requestAccess({ ... });
  res.json(response);
});
```

## Error Handling

```typescript
try {
  const response = await client.requestAccess({ ... });
} catch (error) {
  if (error.message.includes('timeout')) {
    // Request timed out — check network or increase timeout
  } else if (error.message.includes('401')) {
    // Invalid or expired API key
  } else if (error.message.includes('404')) {
    // No vault found for this API key's user
  } else {
    // Server error — SDK auto-retried and all attempts failed
  }
}
```

## Security

- **HMAC-SHA256 signing** — Every request includes timestamp, nonce, and signature headers
- **5-minute timestamp window** — Rejects requests with stale timestamps (prevents replay attacks)
- **Sensitive field redaction** — Debug logs automatically redact `grantedData`, `grantedFields`, and `response_data`
- **No secrets in transit** — SDK receives only the fields the user approved, never the full vault

## Links

- **npm:** [shadowkey-agent-sdk](https://www.npmjs.com/package/shadowkey-agent-sdk)
- **Live Demo:** [shadowkey-ai.vercel.app/agent-demo](https://shadowkey-ai.vercel.app/agent-demo)
- **Dashboard:** [shadowkey-ai.vercel.app](https://shadowkey-ai.vercel.app)
- **Smart Contract:** [Basescan (Verified)](https://basescan.org/address/0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd#code)
- **GitHub:** [kimboltpro3-create/shadowkey](https://github.com/kimboltpro3-create/shadowkey)
- **Issues:** [GitHub Issues](https://github.com/kimboltpro3-create/shadowkey/issues)

## Hackathon Tracks — Synthesis 2026

### ERC-8128: HTTP Message Signatures (Slice Track)

This SDK now ships with a full **ERC-8128** implementation — RFC 9421 HTTP Message Signatures for Ethereum. Agents authenticate each request by signing with their Ethereum wallet instead of using a stored API key.

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
  agentId: 'my-agent',
  requestedFields: ['email'],
  purpose: 'ERC-8128 demo',
  category: 'identity',
  expiresIn: 300,
});
```

Three headers are added automatically to every request:
- `Content-Digest` — SHA-256 hash of the request body
- `Signature-Input` — RFC 9421 metadata (method, path, authority, created, nonce, keyid)
- `Signature` — Ethereum personal_sign over the signature base string

You can also use the primitives directly:

```typescript
import { signRequest, verifyRequest, computeContentDigest } from 'shadowkey-agent-sdk';

// Sign
const headers = await signRequest(signerConfig, { method: 'POST', url, body });

// Verify (server-side)
const recoveredAddress = await verifyRequest({
  method: 'POST', url,
  signatureInput: headers['Signature-Input'],
  signature: headers['Signature'],
  contentDigest: headers['Content-Digest'],
});
```

**Demo:** https://shadowkey-ai.vercel.app/erc8128

---

### Status Network — Gasless AI Agent Attestations

The ShadowKey reputation engine attests AI agent trust scores on-chain via **gasPrice=0** transactions on Status Network Sepolia (Chain ID: 1660990954).

**Contract:** `0x0191d5ada56672507Fdb283AC59d45BDE08a53f8`
**Explorer:** https://sepoliascan.status.network/address/0x0191d5ada56672507Fdb283AC59d45BDE08a53f8
**Demo:** https://shadowkey-ai.vercel.app/status-network

Gasless TX proofs:
- ShoppingAgent (85, TRUSTED): https://sepoliascan.status.network/tx/0x2d876797c5c2a2768aec5bb142b337e669202ab4483eae9963515e9bdc16ad85
- TravelAgent (62, CAUTIOUS): https://sepoliascan.status.network/tx/0x5dfc48d4a851d38a1a773c989858cc541a220cb12dde395f7122ea098522be91
- ResearchAgent (12, BLOCKED): https://sepoliascan.status.network/tx/0x5e1eed02215b703d582abdd2678d420399eb0bfd0df8a4b2e2488ef7ec273bd4

---

### Slice — Future of Commerce + Product Hooks

The ShadowKey SDK powers privacy-first AI agent checkout on Slice stores.

**Demo:** https://shadowkey-ai.vercel.app/slice

**Flow:**

1. Agent calls `requestAccess()` for checkout fields (`billing_name`, `shipping_address`, `card_last4`)
2. Vault owner approves per-field in ShadowKey dashboard
3. Agent builds an ERC-8128 signed checkout request — no API key, wallet signature IS the credential
4. `SliceShadowKeyGate.sol` hook checks agent trust score ≥ 70 before allowing purchase
5. `onProductPurchase()` emits `PrivacyPreservedPurchase` — immutable on-chain consent receipt

**Hook contract (`SliceShadowKeyGate.sol`) — Base Sepolia:**

```solidity
// Implements IProductAction
function isPurchaseAllowed(uint256, uint32, address buyer, bytes calldata)
    external view returns (bool)
{
    return agentRecords[buyer].trusted;  // ShadowKey trust score >= 70
}
```

**Using ERC-8128 for Slice checkout:**

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

// 1. Request scoped vault access
const { requestId } = await client.requestAccess({
  agentId: 'slice-shopping-agent',
  agentName: 'Shopping Agent',
  requestedFields: ['billing_name', 'shipping_address', 'card_last4'],
  purpose: 'Complete Slice store checkout',
  category: 'payment',
});

// 2. Wait for user approval
const result = await client.waitForApproval(requestId);

if (result.status === 'approved') {
  // 3. Proceed — every subsequent request is ERC-8128 signed
  // SliceShadowKeyGate.isPurchaseAllowed() returns true for this agent (score 85)
  console.log('Checkout fields:', result.grantedData);
}
```

---

## License

MIT
