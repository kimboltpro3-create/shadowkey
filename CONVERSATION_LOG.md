# ShadowKey — Human-Agent Collaboration Log

This document records the collaborative process between the human builder and Claude Code agent that produced ShadowKey for The Synthesis hackathon, Track 4: **Agents That Keep Secrets**.

## Project Overview

| Field | Value |
|-------|-------|
| **Hackathon** | The Synthesis — synthesis.devfolio.co |
| **Track** | 4 — Agents That Keep Secrets |
| **Agent** | Claude Code (claude-sonnet-4-6 / claude-opus-4-6) |
| **Human** | Software engineer · crypto: yes · AI agent experience: yes |
| **Build period** | March 12–21, 2026 |
| **Participant ID** | 5902960f4f2d49b6863e74560f9bd4ac |

---

## Phase 1 — Problem Definition (March 12, 2026)

**Human** identified the core problem: AI agents routinely access sensitive user data — payment credentials, health records, identity documents — with no mechanism for the user to control exactly which fields are exposed, to whom, or for how long. The human asked the agent to design a solution.

**Agent** scoped the problem space and proposed a set of interlocking primitives:

- **Field-level consent** — approval is per-field, not per-agent; users grant access to `email` without granting `card_number`
- **On-chain policy enforcement** — agent permissions stored in a smart contract on Base, not in a mutable database row
- **Privacy budget** — agents operate under a configurable daily/weekly disclosure cap enforced on-chain
- **Emergency lockdown** — a single transaction revokes every active agent policy simultaneously
- **Immutable audit log** — every disclosure event is attested on-chain via EAS, independently verifiable

**Human** approved the architecture and confirmed: the emergency lockdown should require an explicit human action to lift — it must never expire automatically.

---

## Phase 2 — Smart Contract (March 13, 2026)

**Agent** designed and implemented `contracts/ShadowVault.sol` (Solidity 0.8.24, Base Sepolia):

| Function | Purpose |
|----------|---------|
| `registerPolicy()` | Creates a per-agent on-chain policy with spend limits and expiry |
| `revokePolicy()` | Disables a single agent's access |
| `logDisclosure()` | Records each data access event immutably with spend tracking |
| `updateBudget()` | Sets daily and weekly privacy budget caps |
| `emergencyLockdown()` | Revokes all active policies in a single transaction |
| `liftLockdown()` | Re-enables the vault (explicit human action required) |

**Agent** wrote 19 contract tests (Hardhat + Chai), all passing. Contract deployed and verified on Base Sepolia: `0x0191d5ada56672507Fdb283AC59d45BDE08a53f8`.

---

## Phase 3 — Backend Infrastructure (March 13–14, 2026)

**Agent** built five Supabase Edge Functions (Deno runtime):

- `sdk-access-request` — validates agent API key via HMAC-SHA256, creates a pending disclosure record with configurable expiry
- `sdk-access-status` — polling endpoint; returns `pending`, `approved`, `denied`, or `expired`
- `access-request` — internal endpoint used by the frontend live demo
- `reverse-disclosure` — handles inbound data requests from third-party services
- `dead-man-switch-cron` — scheduled function enforcing privacy budget caps

**Human** tested the access flow end-to-end and noted that a fixed 5-minute approval window was too short for real-world mobile use. **Agent** updated the API to accept a configurable `expiresIn` parameter (default 300 s, maximum set by policy).

Seven database migrations were applied establishing the vault schema, disclosure logs, consent receipts, agent reputation scores, and agent API key tables.

---

## Phase 4 — React Frontend (March 14–15, 2026)

**Agent** built the full React 18 / TypeScript SPA with Vite:

- **Encrypted vault** — AES-GCM 256-bit encryption via the Web Crypto API; keys are derived and stored client-side and never transmitted
- **Agent policy dashboard** — per-agent, per-field toggle controls with spend limit configuration
- **Real-time approval UI** — Supabase Realtime pushes pending requests to the user's screen; approvals update the requesting agent within milliseconds
- **Privacy budget page** — visualises daily and weekly disclosure spend against configurable caps
- **Ephemeral personas** — temporary identity aliases that expire automatically
- **Dead man's switch page** — emergency lockdown controls with confirmation flow
- **Forensic analysis page** — privacy risk scoring across all past disclosures
- **Reverse disclosure page** — management of inbound data requests from services
- **13-step walkthrough demo** — full end-to-end demonstration of all features

**Human** reviewed the approval modal and requested that sensitive fields (CVV, passport number, health data) be opt-in rather than opt-out — unchecked by default. **Agent** implemented the change, classifying fields by sensitivity tier.

---

## Phase 5 — Agent SDK (March 15–16, 2026)

**Human:** "Can we turn this into an npm package so any agent can integrate with it?"

**Agent** built and published [`shadowkey-agent-sdk@1.1.0`](https://www.npmjs.com/package/shadowkey-agent-sdk):

- `ShadowKeyClient` — constructor accepting `apiUrl`, `apiKey`, `timeout`, `retryAttempts`, `debug`
- `requestAccess(request)` — POSTs a signed access request; returns `requestId` and initial status
- `checkStatus(requestId)` — polls current approval state with full field metadata
- `waitForApproval(requestId, maxWaitMs, pollIntervalMs)` — convenience wrapper that resolves when approved or rejects on denial/timeout
- HMAC-SHA256 request signing with nonce and timestamp to prevent replay attacks
- Zero runtime dependencies; ships CJS, ESM, and TypeScript definitions
- Compatible with Node.js 18+ and browser environments

**Human** tested the SDK against a live vault and confirmed it integrated correctly.

---

## Phase 6 — Live AI Demo & EAS Attestations (March 16–20, 2026)

**Agent** built `AgentDemoPage.tsx` — an interactive, production-grade agent demo:

- Three real-world scenarios: shopping agent (payment fields), travel agent (identity fields), health assistant (medical fields)
- Real LLM calls via OpenRouter (4-model failover: Llama 3.3 70B, Nemotron 49B, StepFun Flash, Nemotron Nano) — the AI autonomously determines which vault fields it needs
- Live SDK integration — each scenario creates a real pending disclosure in Supabase
- Field-level approval UI — the user approves or denies individual fields before the agent proceeds
- Vault secrets are never sent to the LLM; only field-name metadata appears in the AI prompt

**Human:** "Can we add on-chain proof for each approved disclosure?"

**Agent** integrated the Ethereum Attestation Service (EAS) on Base Sepolia. Every approved disclosure generates an on-chain attestation — a cryptographically verifiable, permanent record of the user's consent — linked in the UI to its Basescan entry.

---

## Phase 7 — Final Additions (March 21, 2026)

**Agent** (this session) completed the final submission-ready additions:

- **`examples/claude-sdk/`** — travel booking agent using `@anthropic-ai/sdk` (Claude claude-opus-4-6) with ShadowKey, demonstrating the privacy-preserving pattern natively on the Anthropic SDK alongside the existing OpenRouter and Express examples
- **`AGENTS.md`** — contributor guidelines documenting build commands, TypeScript strict-mode configuration, Hardhat testing, and commit conventions
- **Synthesis registration** — confirmed active; credentials stored securely

---

## Key Human Decisions

| Human input | Agent action |
|-------------|-------------|
| Lockdown must not expire automatically — requires explicit lift | `liftLockdown()` is a separate on-chain transaction; no timer |
| Sensitive fields must be opt-in by default | CVV, passport, health fields pre-unchecked in approval modal |
| 5-minute approval window too short on mobile | Configurable `expiresIn` parameter added to SDK and API |
| SDK should be available as an npm package | Built and published `shadowkey-agent-sdk@1.1.0` |
| Each approved disclosure should have on-chain proof | EAS attestation generated per disclosure on Base Sepolia |
| Need a native Claude SDK example | Added `examples/claude-sdk/travel-agent.js` |

---

## Delivery Summary

| Artefact | Status | Link |
|----------|--------|------|
| Live application | Deployed | https://shadowkey-ai.vercel.app |
| Smart contract | Deployed & verified | https://sepolia.basescan.org/address/0x0191d5ada56672507Fdb283AC59d45BDE08a53f8 |
| Agent SDK | Published | https://www.npmjs.com/package/shadowkey-agent-sdk |
| Contract tests | 19 / 19 passing | `npm run test:contract` |
| Agent examples | 3 complete | OpenRouter · Express · Claude SDK |
| EAS attestations | Active | On Base Sepolia |
