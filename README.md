# ShadowKey

**Human-Controlled Privacy Vault for AI Agents**

> Track 4: Agents That Keep Secrets | [The Synthesis Hackathon](https://synthesis.devfolio.co)

A smart-contract-governed vault where humans define privacy policies and AI agents access only the scoped secrets they need — proving authorization on-chain without exposing identity.

**Live Demo:** [shadowkey-ai.vercel.app](https://shadowkey-ai.vercel.app) | **Agent Demo:** [Live AI Agent](https://shadowkey-ai.vercel.app/agent-demo) | **Demo Video:** [YouTube](https://www.youtube.com/watch?v=cCEVf_IP4ZU) | **Contract:** [Basescan (Verified)](https://basescan.org/address/0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd#code) | **SDK:** [npm](https://www.npmjs.com/package/shadowkey-agent-sdk) | **GitHub:** [Source](https://github.com/kimboltpro3-create/shadowkey)

[![Devfolio](https://img.shields.io/badge/Devfolio-The%20Synthesis-blue?style=for-the-badge&logo=devfolio)](https://synthesis.devfolio.co) [![Base Mainnet](https://img.shields.io/badge/Base-Mainnet-0052FF?style=for-the-badge&logo=coinbase)](https://basescan.org/address/0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd) [![npm](https://img.shields.io/npm/v/shadowkey-agent-sdk?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/shadowkey-agent-sdk) [![Vercel](https://img.shields.io/badge/Vercel-Live-000000?style=for-the-badge&logo=vercel)](https://shadowkey-ai.vercel.app) [![EAS](https://img.shields.io/badge/EAS-Attestations-6366F1?style=for-the-badge)](https://base.easscan.org) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

> **Try it in 30 seconds:** Open the [Shopping Agent demo](https://shadowkey-ai.vercel.app/agent-demo), enter any [OpenRouter API key](https://openrouter.ai/keys) (free), and watch an AI autonomously decide what data it needs, request field-level consent, wait for your approval, and complete a purchase — with cryptographic proof on-chain.

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution: Human-Controlled Disclosure](#the-solution-human-controlled-disclosure)
- [Live Agent Integration](#live-agent-integration)
- [EAS On-Chain Attestations](#eas-on-chain-attestations)
- [Smart Contract: ShadowVault.sol](#smart-contract-shadowvaultsol)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Agent SDK](#agent-sdk)
- [Tech Stack](#tech-stack)
- [Security Model](#security-model)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Hackathon Tracks](#hackathon-tracks)
  - [Protocol Labs — Let the Agent Cook + ERC-8004](#protocol-labs--let-the-agent-cook--erc-8004)
  - [Slice — ERC-8128 + Future of Commerce](#slice--erc-8128--future-of-commerce--product-hooks)
  - [Status Network — Gasless AI Agent Attestations](#status-network--gasless-ai-agent-attestations)
  - [Agents That Keep Secrets](#hackathon-track-agents-that-keep-secrets)
- [Future Roadmap](#future-roadmap)
- [Team](#team)

---

## The Problem

Every time an AI agent acts on your behalf, it leaks information about you. When it books a flight, the airline knows your name, payment info, and travel patterns. When it buys something, the merchant builds a profile. When it calls an API, the provider logs your credentials.

Today's agents operate in a privacy vacuum — there's no layer between "give the agent everything" and "give it nothing."

Humans need a way to:
- **Store** sensitive credentials in one encrypted place
- **Define** granular rules for what agents can access and reveal
- **Prove** authorization on-chain without exposing the human's identity
- **Audit** exactly what the agent disclosed, to whom, and when

---

## The Solution: Human-Controlled Disclosure

ShadowKey puts humans back in control with five interlocking privacy primitives, all enforced both off-chain (Supabase) and **on-chain (Base Mainnet)**:

| Primitive | Problem Solved | On-Chain |
|-----------|---------------|----------|
| **Scoped Policies** | Agents see only the fields you allow, with spend limits and expiration | Policy hash + limits stored in ShadowVault.sol |
| **Privacy Budgets** | Daily/weekly caps prevent gradual privacy erosion | Budget parameters enforced on-chain |
| **Ephemeral Personas** | Temporary pseudonyms break metadata correlation across services | - |
| **Dead Man's Switch** | Auto-revokes all access if you stop checking in | Emergency lockdown on-chain |
| **Reverse Disclosure** | Services must formally request data; you approve field-by-field | - |

All backed by **AES-GCM 256-bit client-side encryption**, **immutable on-chain audit logs**, and **real-time forensic analysis**.

---

## Live Agent Integration

**[Try it live](https://shadowkey-ai.vercel.app/agent-demo)** — Watch a real AI agent request, receive, and use your scoped data in real-time.

### How It Works

```
1. AI Agent thinks     → OpenRouter free models (4-model failover) determine what fields are needed
2. SDK access request  → Creates a real pending disclosure in Supabase
3. User approves       → Owner selects which fields to share vs. deny (field-level control)
4. Scoped data sent    → Agent receives ONLY the approved fields — denied fields show ████████
5. AI completes task   → Agent uses scoped data to finish the job
6. EAS attestation     → On-chain proof of authorized disclosure on Base (via MetaMask)
```

### 3 Real-World Scenarios

| Scenario | Agent | Category | Fields Requested |
|----------|-------|----------|-----------------|
| **Shopping** | ShopBot Pro | Payment | card_number, expiry, billing_name, billing_address, shipping_address |
| **Travel Booking** | TravelAI | Identity | full_name, email, phone, dob, passport_number, passport_country |
| **Health Assistant** | MedAssist AI | Health | blood_type, allergies, medications, conditions, emergency_contact |

Sensitive fields (card_number, cvv, passport_number) are **pre-unchecked** — forcing the user to explicitly opt-in.

---

## EAS On-Chain Attestations

ShadowKey uses the **Ethereum Attestation Service (EAS)** on Base Mainnet to create cryptographic proof of every authorized disclosure — verifiable by anyone on-chain.

### What Gets Attested

When a disclosure is approved, an EAS attestation records:

| Field | Description |
|-------|-------------|
| `disclosureId` | Unique hash of the disclosure request |
| `agentName` | Which AI agent received the data |
| `category` | Data category (payment, identity, health) |
| `approvedFields` | Exactly which fields were shared |
| `deniedFields` | Which fields the user protected |
| `purpose` | Why the data was requested |
| `timestamp` | When the disclosure was authorized |

**No actual data values are ever stored on-chain** — only proof that the disclosure was authorized.

### Verification

- **EAS Scan:** View attestation details at [base.easscan.org](https://base.easscan.org)
- **Basescan:** Verify the transaction at [basescan.org](https://basescan.org)

EAS Contract: `0x4200000000000000000000000000000000000021` (Base Mainnet predeploy)

---

## Smart Contract: ShadowVault.sol

**Deployed on Base Mainnet** | [Verified Source on Basescan](https://basescan.org/address/0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd#code)

```
Contract: 0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd
Network:  Base Mainnet (Chain ID: 8453)
Solidity: 0.8.24 (Shanghai EVM, Optimizer 200 runs)
Tests:    19/19 passing
```

### What Lives On-Chain

| Function | Description |
|----------|-------------|
| `registerPolicy()` | Stores policy hash, agent address, spend limits, expiry on-chain |
| `revokePolicy()` | Permanently disables a policy on-chain |
| `logDisclosure()` | Records every data disclosure with amount + encrypted details hash |
| `updateBudget()` | Sets per-category privacy budget parameters |
| `emergencyLockdown()` | One-click: revokes ALL active policies, locks the vault |
| `liftLockdown()` | Restores vault operations after lockdown |

### On-Chain Fallback

When Supabase is unavailable, the SDK falls back to polling Base Mainnet directly:

- **EAS events** — each approved disclosure emits an `Attested` event on-chain; the SDK watches for this without any server
- **`DisclosureLogged` events** — policy-based approvals emit on-chain events detectable by any JSON-RPC client
- **No wallet required** — the fallback uses a read-only `JsonRpcProvider` pointing at `https://mainnet.base.org`

The agent demo shows this live: a chain watcher activates when waiting for approval, logging each Base Mainnet block and any EAS attestation events detected on-chain.

### Dual-Write Architecture

Every write operation goes to **both** Supabase (fast reads) and **Base blockchain** (verifiable proof):

```
User Action (e.g., Create Policy)
        |
        v
   Supabase Insert (fast, queryable)
        |
        v
   On-Chain Transaction (verifiable, immutable)
        |
        v
   tx_hash stored in Supabase row
        |
        v
   UI shows green "On-chain" badge with Basescan link
```

If the on-chain write fails (no MetaMask, no gas), the Supabase write still succeeds — the app degrades gracefully.

### Gas Cost Analysis

Base Mainnet gas is extremely cheap. At current prices (ETH ≈ $2,156, gas ≈ 0.005 Gwei):

| Operation | Gas Used | Cost (ETH) | Cost (USD) |
|---|---|---|---|
| `registerPolicy()` | ~148,000 | 0.00000074 ETH | **~$0.0016** |
| `logDisclosure()` | ~82,000 | 0.00000041 ETH | **~$0.0009** |
| `revokePolicy()` | ~28,000 | 0.00000014 ETH | **~$0.0003** |
| `updateBudget()` | ~65,000 | 0.00000033 ETH | **~$0.0007** |
| `emergencyLockdown()` | ~55,000 + 25,000/policy | ~0.0000004 ETH | **~$0.0009** |

**A full user session** (register 3 policies + 10 disclosures + 1 lockdown) costs under **$0.015 total** — less than a fraction of a cent per disclosure. Base L2 makes on-chain privacy enforcement economically viable at consumer scale.

---

## Architecture

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|   React SPA      |<--->|  Supabase Edge    |<--->|  Supabase        |
|   (Client-Side   |     |  Functions        |     |  PostgreSQL      |
|    Encryption)   |     |  - access-request |     |  (RLS Enabled)   |
|                  |     |  - dead-man-cron  |     |                  |
|   Wallet Sig     |     |  - reverse-disc   |     |  Real-time       |
|   -> PBKDF2      |     |  - sdk-access     |     |  Subscriptions   |
|   -> AES-GCM     |     +-------------------+     |                  |
|                  |                                +------------------+
+------------------+
        |
        v
+------------------+     +------------------+
|  ShadowVault.sol |     |  EAS Attestations|
|  (Base Mainnet)  |     |  (Base Mainnet)  |
|  - Policies      |     |  - Disclosure    |
|  - Disclosures   |     |    proofs        |
|  - Budgets       |     |  - Field-level   |
|  - Lockdown      |     |    authorization |
+------------------+     +------------------+

Client encrypts/decrypts locally. Server validates policies & budgets.
Blockchain provides verifiable proof. EAS creates attestations.
Plaintext NEVER leaves the browser.
```

### Data Flow: Agent Access Request

```
1. Agent sends request (vault_id, agent_address, category, service_address, amount)
2. Edge Function validates:
   - Active policy exists for agent + category
   - Service is in allowed_services list
   - Transaction within spend_limit
   - Cumulative spend within total_limit
   - Policy not expired
   - Privacy budget not exhausted
3. If valid: returns access token + reveal_fields + persona (if active)
4. Client decrypts secret, returns only allowed fields to agent
5. Disclosure logged to BOTH Supabase and Base blockchain
6. EAS attestation created as on-chain proof of authorized access
7. Budget usage incremented on-chain
```

---

## Key Features

### 1. Encrypted Vault
- AES-GCM 256-bit client-side encryption
- Key derived from wallet signature via PBKDF2 (SHA-256, 100,000 iterations)
- Server stores only ciphertext — zero knowledge of plaintext
- 5 secret categories: Payment, Identity, API Credentials, Health Records, Preferences
- 27 total field types across categories

### 2. Granular Agent Policies (On-Chain)
- Per-agent, per-category access rules
- Field-level reveal/hide controls (e.g., reveal `shipping_address` but hide `card_number`)
- Per-transaction and cumulative spend limits enforced on-chain
- Allowed service whitelist
- Configurable expiration dates
- One-click revocation (on-chain + off-chain)
- Green "On-chain Verified" badge with Basescan link

### 3. Privacy Budget Engine (On-Chain)
- Daily and weekly disclosure caps per category
- Maximum unique services limit
- Daily spending caps enforced on-chain
- Configurable alert thresholds (default 80%)
- Real-time usage tracking with color-coded status
- Automatic denial when budget is exhausted

### 4. Ephemeral Personas
- Generate temporary pseudonymous identities
- Automatic field substitutions (e.g., `full_name` becomes `[REDACTED-ABC1]`)
- Prevents cross-transaction metadata correlation
- Configurable expiration (7/30/90/365 days)

### 5. Dead Man's Switch + Emergency Lockdown (On-Chain)
- Configurable check-in intervals (24h, 3d, 7d, 14d, 30d)
- Emergency lockdown revokes ALL policies on-chain in one transaction
- Warning notifications before deadline
- Cron-based enforcement via Edge Function
- Vault data remains encrypted and recoverable

### 6. Reverse Disclosure
- Services must submit formal data requests with justification
- Vault owner reviews and selectively approves individual fields
- Request lifecycle: pending -> approved/denied/expired
- Full audit trail of every request and response

### 7. Immutable Audit Log (On-Chain)
- Every disclosure event logged on-chain with tx_hash
- Filterable by agent, category, and time
- Green "Verified" badges link directly to Basescan
- CSV export for compliance and record-keeping
- Encrypted details readable only by vault owner

### 8. Forensic Analysis
- **Adversary View**: Reconstructs what each service knows about you
- **Your Reality**: Shows what percentage of your data remains protected
- Risk scoring: Critical / High / Medium / Low per service
- Privacy score based on 27 field types

### 9. Live AI Agent Demo
- **Real OpenRouter AI** calls with 4-model automatic failover
- 3 scenarios: Shopping, Travel, Health
- Split-screen: Agent panel + Vault Owner approval panel
- Field-level approve/deny with sensitive field defaults
- **EAS attestation** after each approved disclosure
- Real-time event log showing every SDK call and data flow

### 10. 13-Step Full Walkthrough Demo
- Automated end-to-end demonstration of all features
- Creates real on-chain transactions
- Tests server-side validation via Edge Functions
- Demonstrates agent lockout after Dead Man's Switch trigger

---

## How ShadowKey Compares

| Capability | ShadowKey | Lit Protocol | Privy | Turnkey |
|---|---|---|---|---|
| Field-level agent consent | ✅ | ❌ | ❌ | ❌ |
| On-chain privacy budget caps | ✅ | ❌ | ❌ | ❌ |
| Per-agent access policies | ✅ | ❌ | ❌ | ❌ |
| EAS-attested audit log | ✅ | ❌ | ❌ | ❌ |
| Emergency lockdown (one tx) | ✅ | ❌ | ❌ | ❌ |
| Published agent SDK (npm) | ✅ | ✅ | ✅ | ✅ |
| Works with any LLM | ✅ | ✅ | ❌ | ❌ |
| Decentralised key management | 🔄 roadmap | ✅ | ✅ | ✅ |

**Lit Protocol** is a general-purpose threshold encryption network — powerful, but not designed for agent access-control patterns. **Privy** handles wallet-native auth, not data disclosure policies. **Turnkey** manages cryptographic keys, not structured privacy vaults. ShadowKey is the only solution designed ground-up for the agent consent problem: field-level, budget-capped, EAS-attested, with a ready-to-use SDK.

---

## Agent SDK

Published on npm: [`shadowkey-agent-sdk`](https://www.npmjs.com/package/shadowkey-agent-sdk)

```bash
npm install shadowkey-agent-sdk
```

```typescript
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

const client = new ShadowKeyClient({
  apiUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'sk_your_api_key_here'
});

// Request scoped access to user data
const response = await client.requestAccess({
  agentId: 'shopping-bot-001',
  agentName: 'Smart Shopping Assistant',
  requestedFields: ['creditCard', 'shippingAddress'],
  purpose: 'Complete purchase of wireless headphones',
  category: 'shopping'
});

// Wait for user approval
const result = await client.waitForApproval(response.requestId);

if (result.status === 'approved') {
  // Only approved fields returned — nothing more
  console.log('Scoped access granted:', result.grantedData);
}
```

### SDK Features
- **API Key Authentication** — Secure token-based auth for agents
- **HMAC-SHA256 Request Signing** — Prevents replay attacks
- **Automatic Retries** — Exponential backoff on failures
- **Polling Support** — Built-in approval polling with timeouts
- **Full TypeScript Types** — Type definitions included
- **Zero Dependencies** — Lightweight, no external deps

### Integration Examples
- **OpenRouter** — 4 free AI models with automatic failover (`/examples/openrouter/`)
- **Express.js** — REST API with request tracking (`/examples/node-express/`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite 5 |
| Blockchain | **ShadowVault.sol on Base Mainnet**, Ethers.js v6 |
| Attestations | **EAS (Ethereum Attestation Service)** on Base Mainnet |
| Smart Contract | Solidity 0.8.24, Hardhat, 19 tests |
| AI Integration | OpenRouter (4 free models with failover) |
| Database | Supabase PostgreSQL (RLS enabled) |
| Auth | MetaMask wallet signature + auto Base Mainnet chain switch |
| Encryption | Web Crypto API (AES-GCM 256-bit, PBKDF2 SHA-256) |
| Serverless | Supabase Edge Functions (Deno runtime) |
| Real-time | Supabase Realtime subscriptions |
| SDK | npm: `shadowkey-agent-sdk` (TypeScript, zero deps) |
| Hosting | Vercel |
| i18n | react-i18next (English, Tamil, Hindi, Spanish, French) |

---

## Security Model

### Encryption Architecture

```
Wallet Signature
      |
      v
  PBKDF2 (SHA-256, 100k iterations, random salt)
      |
      v
  AES-GCM 256-bit Key
      |
      +---> Encrypt secret fields -> ciphertext + IV + salt -> Supabase
      |
      +---> Encrypt audit details -> encrypted_details + IV -> Supabase
      |
      +---> Policy hash + limits -> ShadowVault.sol on Base
      |
      +---> EAS attestation -> proof of authorized disclosure on Base
```

### What ShadowKey Protects Against

| Threat | Mitigation |
|--------|-----------|
| Server compromise | Only ciphertext stored; useless without wallet signature |
| Agent oversharing | Policies enforce field-level scoping with on-chain spend limits |
| Privacy erosion | On-chain budgets cap daily/weekly disclosures per category |
| Metadata correlation | Ephemeral personas provide different identities per service |
| User incapacitation | Dead man's switch triggers on-chain emergency lockdown |
| Service overreach | Reverse disclosure requires formal request + user approval |
| Tampering | All policy/disclosure actions verifiable on Basescan |
| Unauthorized access | EAS attestations provide cryptographic proof of authorization |

### Trust Boundaries

- **Trusted:** Your browser, your wallet, Web Crypto API, Base blockchain, EAS
- **Untrusted:** The server (by design), AI agents (constrained by policies), services (constrained by disclosure rules)

---

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask browser extension (demo mode works without it)

### Installation

```bash
git clone https://github.com/kimboltpro3-create/shadowkey.git
cd shadowkey
npm install
```

### Environment Variables

Create a `.env` file (see `.env.example`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SHADOW_VAULT_ADDRESS=0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd
VITE_CHAIN_ID=8453
```

### Run

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test:contract # Run 19 smart contract tests
npm run deploy:sepolia # Deploy contract to Base Sepolia testnet
```

### First Run

1. Open the app in your browser
2. Click **"Connect Wallet & Unlock Vault"** — MetaMask auto-switches to Base Mainnet
3. Try the **[Live Agent Demo](https://shadowkey-ai.vercel.app/agent-demo)** — launch an AI agent and approve/deny fields in real-time
4. Navigate to **Live Demo** and click **"Run Full Demo"** to see all 13 steps
5. Every policy and disclosure creates a real on-chain transaction

---

## Project Structure

```
shadowkey/
  contracts/
    ShadowVault.sol        # Smart contract (deployed on Base Mainnet)
  test/
    ShadowVault.test.cjs   # 19 Hardhat tests
  scripts/
    deploy.cjs             # Deployment script
  sdk/
    src/
      client.ts            # Agent SDK client
      types.ts             # TypeScript types
      index.ts             # SDK entry point
    README.md              # SDK documentation
  src/
    components/
      layout/              # Header, Layout, Sidebar
      policies/            # PolicyCard, CreatePolicyModal, SimulatePolicyModal
      ui/                  # Badge, Button, Modal, Toast
      vault/               # AddSecretModal, CategoryIcon, SecretCard
    context/
      AppContext.tsx        # Global state + wallet + Base Mainnet chain switching
    lib/
      contract.ts          # Ethers.js v6 wrappers for ShadowVault.sol
      eas.ts               # EAS attestation helpers (register schema, create attestation)
      ShadowVaultABI.json  # Contract ABI
      constants.ts         # Categories, fields, Base chain config
      crypto.ts            # AES-GCM encryption/decryption
      shadowVault.ts       # Core vault operations (dual-write to chain + Supabase)
      lockdown.ts          # Emergency lockdown (dual-write)
      supabase.ts          # Supabase client
    pages/
      AgentDemoPage.tsx    # Live AI agent integration (OpenRouter + EAS attestation)
      ConnectPage.tsx      # Landing page + wallet connection
      VaultPage.tsx        # Encrypted secret storage
      PoliciesPage.tsx     # Agent policy management
      AuditPage.tsx        # Disclosure audit log (with Basescan links)
      PrivacyBudgetPage.tsx # Budget configuration
      PersonasPage.tsx     # Ephemeral persona management
      DeadManSwitchPage.tsx # Dead man's switch controls
      ForensicsPage.tsx    # Privacy forensic analysis
      ReverseDisclosurePage.tsx # Inbound request management
      DemoPage.tsx         # 13-step live demo
      SDKPlaygroundPage.tsx # SDK testing interface
    types/
      index.ts             # TypeScript types (Policy, DisclosureLog with tx_hash)
  supabase/
    functions/
      access-request/      # Agent access validation
      sdk-access-request/  # SDK access endpoint
      sdk-access-status/   # SDK status polling endpoint
      dead-man-switch-cron/ # Periodic enforcement
      reverse-disclosure/  # Inbound data requests
  hardhat.config.cjs       # Hardhat config (Base Mainnet + Mainnet)
  vercel.json              # Vercel SPA routing
  package.json
```

---

## Hackathon Tracks

ShadowKey enters **6 tracks** across 3 sponsors. Each track has a dedicated README:

| Sponsor | Track | Prize | README | Demo |
|---------|-------|-------|--------|------|
| Protocol Labs | Let the Agent Cook | $4,000 | [docs/PROTOCOL_LABS.md](docs/PROTOCOL_LABS.md) | [/status-network](https://shadowkey-ai.vercel.app/status-network) |
| Protocol Labs | Agents With Receipts (ERC-8004) | $4,000 | [docs/PROTOCOL_LABS.md](docs/PROTOCOL_LABS.md) | [/status-network](https://shadowkey-ai.vercel.app/status-network) |
| Slice | ERC-8128 Agent Auth | $500 | [docs/SLICE.md](docs/SLICE.md) | [/erc8128](https://shadowkey-ai.vercel.app/erc8128) |
| Slice | Future of Commerce | $750 | [docs/SLICE.md](docs/SLICE.md) | [/slice](https://shadowkey-ai.vercel.app/slice) |
| Slice | Product Hooks | $700 | [docs/SLICE.md](docs/SLICE.md) | [/slice](https://shadowkey-ai.vercel.app/slice) |
| Status Network | Gasless Attestations | $50 | [docs/STATUS_NETWORK.md](docs/STATUS_NETWORK.md) | [/status-network](https://shadowkey-ai.vercel.app/status-network) |

**DevSpot Agent Manifest (Protocol Labs requirement):**
- [`agent.json`](agent.json) — name, operator wallet, tools, compute constraints, task categories
- [`agent_log.json`](agent_log.json) — structured execution log with decisions, tx proofs, safety checks

---

### Protocol Labs — Let the Agent Cook + ERC-8004

**Full details:** [docs/PROTOCOL_LABS.md](docs/PROTOCOL_LABS.md)

The ShadowKey Reputation Agent runs a full autonomous decision loop with no human intervention:

```
DISCOVER → PLAN → EXECUTE → VERIFY → SUBMIT
Read trust  Evaluate  attest()   Confirm   Log all
scores from each agent gasPrice=0 on-chain  decisions
Supabase   vs ≥70     on Status  receipt   + TX proofs
```

- **ERC-8004 Equivalent:** `ShadowKeyAttestation.sol` = reputation registry, `SliceShadowKeyGate.sol` = validation registry
- **Tool Use:** Supabase API + ethers.js + Status Network RPC + ShadowKey SDK + ERC-8128 signer
- **Safety:** zero-address validation, explicit gas limits, sequential tx confirmation, read-only data access
- **Gasless TX proofs** (gasPrice=0): [ShoppingAgent](https://sepolia.explorer.status.network/tx/0xae1c066cf62a468f7ce626d91bcfa4cec2a30107e0ac26cc55570726c5386db7) · [TravelAgent](https://sepolia.explorer.status.network/tx/0xe46cba7ea79be170ccbf5228a121131bb8b4c4eb5c2ddc589d9d4ee174dfd7f9) · [ResearchAgent](https://sepolia.explorer.status.network/tx/0x964434b7ae6c14c8c28c106a0a588b6a10398b2b28ae9f7e8617681714f3bb0c)

---

### Slice — ERC-8128 + Future of Commerce + Product Hooks

**Full details:** [docs/SLICE.md](docs/SLICE.md)

All three Slice tracks connect into one agent checkout flow:

```
Agent requests vault fields → User approves per-field → ERC-8128 signed checkout
→ SliceShadowKeyGate.isPurchaseAllowed() → Purchase + PrivacyPreservedPurchase receipt
```

- **ERC-8128** (`sdk/src/erc8128.ts`): RFC 9421 HTTP Message Signatures — every request wallet-signed, no API keys
- **Future of Commerce** (`/slice`): AI agent shops with scoped vault access; user approves per-field; consent receipt on-chain
- **Product Hooks** (`SliceShadowKeyGate.sol`): `IProductAction` on Base — trust score ≥ 70 required to purchase

---

### Status Network — Gasless AI Agent Attestations

**Full details:** [docs/STATUS_NETWORK.md](docs/STATUS_NETWORK.md)

- **Contract:** `0x0191d5ada56672507Fdb283AC59d45BDE08a53f8` on Status Network Sepolia
- **3 gasless TX proofs** (gasPrice=0 Wei) — ShoppingAgent (85) · TravelAgent (62) · ResearchAgent (12)
- Autonomous: no human approves attestations; reputation agent decides and submits

```bash
npm run deploy:status    # deploy ShadowKeyAttestation.sol to Status Network Sepolia
npm run gasless:demo     # run reputation agent — 3 gasless attestations
npm run deploy:slice-gate # deploy SliceShadowKeyGate.sol to Base Sepolia
```

---

### Hackathon Track: Agents That Keep Secrets

ShadowKey addresses the core challenge of Track 4: **How do we build AI agents that can act on our behalf while keeping our secrets safe?**

### Why ShadowKey Wins

1. **Real blockchain integration** — ShadowVault.sol deployed and verified on Base Mainnet, not simulated
2. **EAS attestations** — On-chain cryptographic proof of every authorized disclosure
3. **Live AI agent demo** — Real OpenRouter AI + real-time approval flow + on-chain attestation
4. **Dual-write pattern** — Every action is verifiable on-chain AND queryable off-chain
5. **Working SDK on npm** — `shadowkey-agent-sdk` published, ready for agent developers
6. **5 interlocking privacy primitives** — Not just one feature, a complete privacy stack
7. **Client-side encryption** — Server literally cannot read your secrets
8. **Emergency lockdown** — One transaction revokes everything on-chain
9. **19/19 contract tests** — Production-quality smart contract
10. **Live demos** — 13-step walkthrough + AI agent demo with real on-chain transactions
11. **Forensic analysis** — See exactly what each service knows about you
12. **Multi-language** — i18n support for English, Tamil, Hindi, Spanish, French

---

## Future Roadmap

- **ERC-8004 agent identity** standard integration for verifiable agent identities
- **Decentralised key management** via threshold encryption (e.g. Lit Protocol)
- **Multi-wallet support** for managing multiple vaults
- **Policy templates marketplace** for common agent configurations
- **Hardware wallet integration** (Ledger, Trezor)
- **Mobile native app** with biometric authentication
- **Graph visualization** of service knowledge networks

---

## Team

Built by **MUTHUKUMARAN K** for [The Synthesis Hackathon](https://synthesis.devfolio.co)

---

## License

MIT
