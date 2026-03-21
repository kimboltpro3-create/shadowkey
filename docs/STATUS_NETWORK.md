# ShadowKey × Status Network

**Track:** Gasless AI Agent Attestations
**Prize Pool:** $50 guaranteed (shared $2,000 pool across ≤40 teams)
**Sponsor:** Status Network — [status.network](https://status.network)

---

## Overview

ShadowKey deploys an autonomous AI reputation engine that reads agent trust scores and attests them on-chain using **gasPrice=0** transactions on Status Network Sepolia — the only L2 where gas is free at the protocol level.

No human approves individual attestations. The agent decides.

---

## Contract

**`ShadowKeyAttestation.sol`** — deployed on Status Network Sepolia

| Field | Value |
|-------|-------|
| **Address** | `0x0191d5ada56672507Fdb283AC59d45BDE08a53f8` |
| **Chain** | Status Network Sepolia (Chain ID: 1660990954) |
| **Explorer** | [sepolia.explorer.status.network/address/0x0191d…](https://sepolia.explorer.status.network/address/0x0191d5ada56672507Fdb283AC59d45BDE08a53f8) |
| **Gas Price** | 0 (gasless at protocol level) |

### Contract Interface

```solidity
// Called autonomously by the ShadowKey reputation agent
function attest(address agentAddress, uint8 trustScore) external onlyOwner

// Revoke a previously attested agent (score dropped below threshold)
function revoke(address agentAddress) external onlyOwner

// Read trust status
function isTrusted(address agent) external view returns (bool)
function getAttestation(address agent) external view returns (Attestation memory)
```

### Trust Threshold

Agents with score ≥ 70 are marked `trusted = true`. This mirrors ShadowKey's `getTrustLevel()` function in `src/lib/agentReputation.ts`.

---

## Gasless Transaction Proofs

All three attestations below have **gasPrice = 0** — verified on the Status Network Sepolia explorer.

| Agent | Trust Score | Decision | Transaction |
|-------|-------------|----------|-------------|
| ShoppingAgent | 85 / 100 | TRUSTED ✅ | [0xae1c066c…](https://sepolia.explorer.status.network/tx/0xae1c066cf62a468f7ce626d91bcfa4cec2a30107e0ac26cc55570726c5386db7) |
| TravelAgent | 62 / 100 | CAUTIOUS ⚠️ | [0xe46cba7e…](https://sepolia.explorer.status.network/tx/0xe46cba7ea79be170ccbf5228a121131bb8b4c4eb5c2ddc589d9d4ee174dfd7f9) |
| ResearchAgent | 12 / 100 | BLOCKED ❌ | [0x964434b7…](https://sepolia.explorer.status.network/tx/0x964434b7ae6c14c8c28c106a0a588b6a10398b2b28ae9f7e8617681714f3bb0c) |

> Open any transaction → **Gas Price** column shows `0 Wei` in the Status Network Sepolia explorer.

---

## AI Agent Component

The **ShadowKey Reputation Agent** operates fully autonomously:

1. Reads agent trust scores from the ShadowKey reputation engine (computed from disclosure history: approved requests, budget violations, denied requests)
2. Evaluates each agent against the 70-point threshold
3. Submits `attest(agentAddress, trustScore)` with `gasPrice=0, gasLimit=200000`
4. Logs each decision with explorer links

**Key code:** [`scripts/gaslessAttest.cjs`](../scripts/gaslessAttest.cjs)

```javascript
// Critical: gasPrice=0 makes tx free on Status Network
const tx = await contract.attest(agentAddress, score, {
  gasPrice: 0,
  gasLimit: 200000,
});
```

No human decision is involved. The agent autonomously:
- Determines which agents to attest (score ≥ 70 → TRUSTED)
- Decides which to skip (CAUTIOUS / BLOCKED agents are not attested)
- Submits all transactions in sequence

---

## Demo Page

**Live:** [shadowkey-ai.vercel.app/status-network](https://shadowkey-ai.vercel.app/status-network)

The `/status-network` page lets judges:
- View the 3 pre-run gasless attestations with direct explorer links
- Connect MetaMask to Status Network Sepolia and run live attestations themselves
- Watch the agent log update in real-time as it evaluates and attests each agent

**Connect MetaMask button** automatically adds Status Network Sepolia via `wallet_addEthereumChain`:
```javascript
chainId: '0x630d2baa',  // 1660990954
rpcUrls: ['https://public.sepolia.rpc.status.network'],
```

---

## Files

| File | Purpose |
|------|---------|
| [`contracts/ShadowKeyAttestation.sol`](../contracts/ShadowKeyAttestation.sol) | On-chain attestation contract |
| [`scripts/deployAttestation.cjs`](../scripts/deployAttestation.cjs) | Deployment script |
| [`scripts/gaslessAttest.cjs`](../scripts/gaslessAttest.cjs) | Autonomous reputation agent (runs 3 gasless txs) |
| [`src/lib/ShadowKeyAttestationABI.json`](../src/lib/ShadowKeyAttestationABI.json) | ABI for frontend |
| [`src/pages/StatusNetworkPage.tsx`](../src/pages/StatusNetworkPage.tsx) | Demo page |
| [`src/lib/constants.ts`](../src/lib/constants.ts) | `STATUS_NETWORK_SEPOLIA_CONFIG`, chain ID |
| [`hardhat.config.cjs`](../hardhat.config.cjs) | `statusNetworkSepolia` network config |

---

## Reproduce

```bash
# 1. Compile
npm run compile

# 2. Deploy to Status Network Sepolia (requires ETH from bridge.status.network)
npm run deploy:status

# 3. Run the autonomous reputation agent (3 gasless attestations)
ATTESTATION_CONTRACT_ADDRESS=0x... npm run gasless:demo
```

> **Note:** Status Network's zkEVM uses EVM version "paris" (not "shanghai") — PUSH0 opcode is not supported. The `hardhat.config.cjs` sets `evmVersion: "paris"` to handle this.

---

## Why Status Network

Status Network is uniquely suited for AI agent attestations because:
- **gasPrice=0** at the protocol level — agents can attest cheaply and frequently without gas cost concerns
- **zkEVM** — EVM-compatible, so all existing Solidity tooling works
- **Low latency** — fast finality for real-time trust decisions
- **Sepolia testnet** — production-equivalent environment for hackathon demos

For ShadowKey, this means the reputation engine can attest every trusted agent after every vault interaction — a continuous trust signal rather than a one-time registration.
