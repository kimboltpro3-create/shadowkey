# ShadowKey × Protocol Labs

**Tracks:** Let the Agent Cook · Agents With Receipts (ERC-8004)
**Prize Pool:** $4,000 (Let the Agent Cook) + $4,000 (Agents With Receipts) = $8,000 total
**Sponsor:** Protocol Labs — [protocol.ai](https://www.protocol.ai)
**Shared Track:** Synthesis Hackathon (March 13–22) × PL_Genesis (through March 31)

---

## DevSpot Agent Manifest

| File | Description |
|------|-------------|
| [`agent.json`](../agent.json) | Machine-readable agent manifest (name, operator wallet, tools, compute constraints) |
| [`agent_log.json`](../agent_log.json) | Structured execution log — decisions, tool calls, tx proofs, safety checks |

---

## Track 1 — Let the Agent Cook ($4,000)

**Judging criteria:** Autonomy (35%) · Tool Use (25%) · Guardrails & Safety (20%) · Impact (15%) · ERC-8004 Bonus (5%)

### What the Agent Does

The **ShadowKey Reputation Agent** operates a complete autonomous decision loop:

```
DISCOVER → PLAN → EXECUTE → VERIFY → SUBMIT
   │           │        │         │        │
Read trust  Evaluate  Submit    Confirm  Log all
scores from each agent gasless   tx on    decisions
Supabase   vs ≥70 thr. attest() explorer + proofs
```

**No human approves individual attestations.** The agent reads off-chain trust state, makes a binary decision (TRUSTED / CAUTIOUS / BLOCKED) for each agent, submits an on-chain transaction, verifies the receipt, and produces a complete execution log.

### Autonomy (35%) — Full Decision Loop

**Script:** [`scripts/gaslessAttest.cjs`](../scripts/gaslessAttest.cjs)

| Phase | What happens |
|-------|-------------|
| **Discover** | Reads agent list and trust scores from `agent_reputation` table in Supabase |
| **Plan** | Evaluates each agent: `score >= 70 → TRUSTED`, computes `isTrusted` flag |
| **Execute** | Calls `ShadowKeyAttestation.attest(address, score)` with `gasPrice: 0` |
| **Verify** | Awaits `tx.wait()`, confirms receipt, extracts block number and gas used |
| **Submit** | Logs all 3 decisions with full explorer links and execution summary |

**Self-correction:** If a transaction fails, the agent logs the error and continues to the next agent (partial failure doesn't abort the run). See `compute_constraints.abort_on_consecutive_failures: 3` in `agent.json`.

### Tool Use (25%) — Multi-Tool Orchestration

| Tool | Type | Used For |
|------|------|----------|
| `supabase_query` | Data API | Read trust scores from reputation engine |
| `ethereum_transaction` | Blockchain | Submit `attest()` via ethers.js |
| `status_network_rpc` | RPC Endpoint | Gasless tx submission + receipt confirmation |
| `shadowkey_sdk` | SDK (npm) | Vault access requests in shopping agent demo |
| `erc8128_signer` | Auth Primitive | Sign HTTP requests with Ethereum key |

**Multi-tool orchestration demonstrated:**
1. Supabase API → trust score data
2. Reputation engine → decision computation
3. ethers.js → transaction construction with `gasPrice: 0`
4. Status Network RPC → tx submission and confirmation
5. Explorer URL construction → human-verifiable proof

### Guardrails & Safety (20%)

All safety checks pass — see `agent_log.json` → `safety_checks_passed`.

| Guardrail | Implementation |
|-----------|---------------|
| **Zero-address validation** | `require(agentAddress != address(0), "Zero address")` in Solidity |
| **Explicit gas limit** | `gasLimit: 200000` — prevents runaway gas consumption |
| **Sequential confirmation** | Each tx confirmed before next agent is processed |
| **Read-only data access** | Supabase agent reads use SELECT only, no credential mutations |
| **Contract-level enforcement** | Trust threshold enforced in Solidity, cannot be bypassed client-side |
| **ERC-8128 replay protection** | 5-minute timestamp window + nonce prevents request replay |
| **Compute budget awareness** | 9 RPC calls used of 20 budget (45% utilization) |

### Impact (15%) — Real Problem Solved

**Problem:** AI agents interact with dozens of services on your behalf. There's no accountability layer — you can't tell which agents are trustworthy, and services can't verify it either.

**ShadowKey's solution:**
- Privacy vault gives humans field-level control over what agents can access
- Reputation engine scores agents based on their actual behavior (did they respect consent? did they stay within budget?)
- Autonomous attestation agent makes these trust scores immutable and on-chain
- Slice hook uses trust scores as a purchase gate — untrusted agents literally cannot complete transactions

**Real-world deployment:**
- `ShadowVault.sol` verified on Base Mainnet: [`0xC739f...`](https://basescan.org/address/0xC739f98B438620A9326Ddb7548201Bcd78a3DBAd)
- `ShadowKeyAttestation.sol` live on Status Network Sepolia with 3 confirmed gasless txs
- SDK published on npm: [`shadowkey-agent-sdk`](https://www.npmjs.com/package/shadowkey-agent-sdk)
- Live demo with real OpenRouter AI: [shadowkey-ai.vercel.app/agent-demo](https://shadowkey-ai.vercel.app/agent-demo)

### Confirmed Execution Proofs

Run `npm run gasless:demo` to reproduce. Pre-run proofs:

| Agent | Score | Decision | TX Hash | Gas Price |
|-------|-------|----------|---------|-----------|
| ShoppingAgent | 85 | TRUSTED | [0xae1c066c…](https://sepoliascan.status.network/tx/0x2d876797c5c2a2768aec5bb142b337e669202ab4483eae9963515e9bdc16ad85) | 0 Wei |
| TravelAgent | 62 | CAUTIOUS | [0xe46cba7e…](https://sepoliascan.status.network/tx/0x5dfc48d4a851d38a1a773c989858cc541a220cb12dde395f7122ea098522be91) | 0 Wei |
| ResearchAgent | 12 | BLOCKED | [0x964434b7…](https://sepoliascan.status.network/tx/0x5e1eed02215b703d582abdd2678d420399eb0bfd0df8a4b2e2488ef7ec273bd4) | 0 Wei |

---

## Track 2 — Agents With Receipts: ERC-8004 ($4,000)

**Required:** ERC-8004 integration · Autonomous agent architecture · Agent identity + operator model · Onchain verifiability · DevSpot Agent Manifest

### ERC-8004 Integration

ShadowKey's trust architecture is a natural implementation of ERC-8004 principles:

| ERC-8004 Concept | ShadowKey Implementation |
|-----------------|--------------------------|
| **Identity Registry** | Agent addresses registered in `agent_reputation` table; operator wallet = `0x9a985E6…` |
| **Reputation Registry** | `ShadowKeyAttestation.sol` — on-chain `trustScore` (0–100) per agent address |
| **Validation Registry** | `SliceShadowKeyGate.sol` — validates agent trust before allowing Slice purchases |
| **Operator Model** | `ShadowKeyAttestation.owner` = deployer wallet; only operator can attest |
| **Onchain Verifiable** | All attestations viewable on Status Network Sepolia explorer |

**Agent identity anchor:**
```
Operator wallet: 0x9a985E67069945c69174804E0037b1061B9414Ac
Attestation contract: 0x0191d5ada56672507Fdb283AC59d45BDE08a53f8 (Status Network Sepolia)
```

### Trust-Gated Agent Transactions

The Slice hook demonstrates ERC-8004's core value proposition — trust-gated transactions:

```
Agent wants to purchase on Slice
         │
SliceShadowKeyGate.isPurchaseAllowed(buyer)
         │
   buyer.trusted? ──── No ────→ Purchase BLOCKED
         │
        Yes
         │
   Purchase proceeds
         │
   PrivacyPreservedPurchase event emitted (consent receipt)
```

This is "Trust-Gated Agent Transactions" from the ERC-8004 example ideas list, implemented end-to-end.

### Reputation-Aware Agent Routing

The ShadowKey reputation engine scores agents based on:

| Behavior | Effect on Score |
|----------|----------------|
| Approved disclosures | +points (agent respected consent) |
| Budget violations | -points (agent exceeded spending caps) |
| Denied requests | -points (agent requested unauthorized fields) |

Score tiers: **Trusted** (≥70) · **Cautious** (40–69) · **Untrusted** (15–39) · **Blocked** (<15)

The autonomous attestation agent acts as a **reputation-aware router** — it reads these scores and decides which agents should be publicly trusted on-chain.

### Onchain Verifiability

All ERC-8004-equivalent operations are verifiable on-chain:

1. **Reputation registry** — `ShadowKeyAttestation.attestations[agentAddress]` stores score, timestamp, trusted flag
2. **Attestation events** — `AgentAttested(agentAddress, trustScore, trusted, timestamp)` emitted for every attestation
3. **Validation in action** — `PrivacyPreservedPurchase` events on Base (SliceShadowKeyGate) when trusted agents complete purchases
4. **Base Mainnet vault** — `ShadowVault.sol` records every authorized disclosure with policy hash

### DevSpot Compatibility

| Requirement | File | Status |
|-------------|------|--------|
| `agent.json` | [`agent.json`](../agent.json) | ✅ Includes name, operator wallet, tools, compute constraints, task categories |
| `agent_log.json` | [`agent_log.json`](../agent_log.json) | ✅ Includes all 9 execution steps, tool calls, safety checks, tx proofs |
| ERC-8004 identity | `agent.json → erc8004` | ✅ Identity anchor in agent.json |
| Onchain verifiability | Status Network txs | ✅ 3 confirmed gasless txs |
| Autonomous architecture | `gaslessAttest.cjs` | ✅ Full discover→plan→execute→verify→submit loop |

### Multi-Agent Architecture

ShadowKey operates multiple specialized agents:

| Agent | Role | Trust Score |
|-------|------|-------------|
| **ShadowKey Reputation Agent** | Computes trust scores, attests on Status Network | Operator (privileged) |
| **Shopping Agent** | Purchases on behalf of vault owner | 85 / 100 — TRUSTED |
| **Travel Agent** | Books travel (demo) | 62 / 100 — CAUTIOUS |
| **Research Agent** | Reads/queries data | 12 / 100 — BLOCKED |

The reputation agent evaluates the other agents and makes attestation decisions autonomously. Shopping Agent's trust status gates its ability to complete Slice purchases — a direct agent-to-agent trust dependency.

---

## Running the Agent

```bash
# Install
npm install

# Compile contracts
npm run compile

# Run the autonomous reputation agent
# (Reads trust scores → evaluates → attests with gasPrice=0 on Status Network)
ATTESTATION_CONTRACT_ADDRESS=0x0191d5ada56672507Fdb283AC59d45BDE08a53f8 \
DEPLOYER_PRIVATE_KEY=<your_key> \
node scripts/gaslessAttest.cjs

# Output:
# [ShadowKey Reputation Agent] Starting autonomous attestation run...
# [DISCOVER] Loading agent trust scores...
# [PLAN] ShoppingAgent: score=85 → TRUSTED
# [PLAN] TravelAgent: score=62 → CAUTIOUS
# [PLAN] ResearchAgent: score=12 → BLOCKED
# [EXECUTE] Attesting ShoppingAgent (gasPrice=0)...
# [VERIFY] TX confirmed: 0xae1c066c... | https://sepoliascan.status.network/tx/...
# ...
# [SUBMIT] Run complete: 3/3 attestations confirmed. Total gas cost: $0.00
```

**Live demo:** [shadowkey-ai.vercel.app/status-network](https://shadowkey-ai.vercel.app/status-network) — click "Run AI Reputation Agent" to watch the loop execute in the browser.

---

## Files

| File | Purpose |
|------|---------|
| [`agent.json`](../agent.json) | DevSpot Agent Manifest |
| [`agent_log.json`](../agent_log.json) | Structured execution log |
| [`scripts/gaslessAttest.cjs`](../scripts/gaslessAttest.cjs) | Autonomous reputation agent (discover→submit loop) |
| [`contracts/ShadowKeyAttestation.sol`](../contracts/ShadowKeyAttestation.sol) | On-chain trust registry (reputation registry) |
| [`contracts/SliceShadowKeyGate.sol`](../contracts/SliceShadowKeyGate.sol) | Trust-gated transactions (validation registry) |
| [`src/lib/agentReputation.ts`](../src/lib/agentReputation.ts) | Reputation computation engine (off-chain) |
| [`src/pages/StatusNetworkPage.tsx`](../src/pages/StatusNetworkPage.tsx) | Live agent demo page |
| [`sdk/src/erc8128.ts`](../sdk/src/erc8128.ts) | ERC-8128 — agent identity auth per request |
