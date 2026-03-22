/**
 * gaslessAttest.cjs
 *
 * Demonstrates gasless transactions on Status Network Sepolia.
 * Status Network sets baseFeePerGas=0 at the protocol level —
 * transactions cost nothing in gas fees.
 *
 * This script simulates the ShadowKey AI reputation agent:
 * it reads agent trust scores and autonomously attests trusted agents
 * on-chain via gasless transactions.
 *
 * Usage:
 *   ATTESTATION_CONTRACT_ADDRESS=0x... DEPLOYER_PRIVATE_KEY=0x... node scripts/gaslessAttest.cjs
 */
require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = "https://public.sepolia.rpc.status.network";
const CONTRACT_ADDRESS = process.env.ATTESTATION_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!CONTRACT_ADDRESS) {
  console.error("ERROR: ATTESTATION_CONTRACT_ADDRESS not set in .env");
  process.exit(1);
}
if (!PRIVATE_KEY) {
  console.error("ERROR: DEPLOYER_PRIVATE_KEY not set in .env");
  process.exit(1);
}

const ABI = [
  "function attest(address agentAddress, uint8 trustScore) external",
  "function isTrusted(address agent) external view returns (bool)",
  "function attestationCount() external view returns (uint256)",
  "event AgentAttested(address indexed agentAddress, uint8 trustScore, bool trusted, uint64 timestamp)",
];

// Demo agents matching DEMO_AGENT_ADDRESSES in src/lib/constants.ts
// Trust scores mirror the getTrustLevel() thresholds: >=70 TRUSTED, >=40 CAUTIOUS, >=15 UNTRUSTED, <15 BLOCKED
const DEMO_AGENTS = [
  { address: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", score: 85, name: "ShoppingAgent", decision: "TRUSTED" },
  { address: "0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3", score: 62, name: "TravelAgent",   decision: "CAUTIOUS" },
  { address: "0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", score: 12, name: "ResearchAgent", decision: "BLOCKED" },
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  const network = await provider.getNetwork();
  console.log("=== ShadowKey AI Reputation Agent ===");
  console.log("Network:", network.name, "| Chain ID:", network.chainId.toString());
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Agent wallet:", wallet.address);
  console.log("");
  console.log("Status Network Sepolia uses gasPrice=0 at the protocol level.");
  console.log("These are real on-chain transactions — no gas fees paid.\n");

  const txHashes = [];

  for (const agent of DEMO_AGENTS) {
    console.log(`[${agent.decision}] Attesting ${agent.name} (score: ${agent.score})...`);

    const tx = await contract.attest(agent.address, agent.score, {
      gasPrice: 0,       // Status Network protocol-level gasless
      gasLimit: 200000,  // Explicit limit — skip gas estimation
    });

    console.log(`  TX hash:  ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  Block:    ${receipt.blockNumber}`);
    console.log(`  Gas used: ${receipt.gasUsed.toString()} (gas price: 0)`);
    console.log(`  Explorer: https://sepoliascan.status.network/tx/${tx.hash}\n`);

    txHashes.push({ agent: agent.name, decision: agent.decision, score: agent.score, hash: tx.hash });
  }

  const count = await contract.attestationCount();
  console.log(`Total attestations on-chain: ${count.toString()}`);
  console.log("\n=== TX Hashes for README ===");
  for (const t of txHashes) {
    console.log(`${t.agent} (score ${t.score}, ${t.decision}): https://sepoliascan.status.network/tx/${t.hash}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
