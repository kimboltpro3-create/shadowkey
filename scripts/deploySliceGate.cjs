/**
 * Deploy SliceShadowKeyGate to Base Sepolia.
 * Usage: npx hardhat run scripts/deploySliceGate.cjs --network baseSepolia
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying SliceShadowKeyGate with:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("SliceShadowKeyGate");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SliceShadowKeyGate deployed to:", address);
  console.log("Explorer: https://sepolia.basescan.org/address/" + address);

  // Seed the contract with the demo agent trust records
  // These mirror the Status Network attestations from gaslessAttest.cjs
  const DEMO_AGENTS = [
    { address: "0x1111111111111111111111111111111111111111", score: 85, name: "ShoppingAgent" },
    { address: "0x2222222222222222222222222222222222222222", score: 62, name: "TravelAgent" },
    { address: "0x3333333333333333333333333333333333333333", score: 12, name: "ResearchAgent" },
  ];

  console.log("\nSeeding agent trust records...");
  for (const agent of DEMO_AGENTS) {
    const tx = await contract.setAgentTrust(agent.address, agent.score);
    await tx.wait();
    const trusted = agent.score >= 70;
    console.log(`  ${agent.name} (${agent.score}) → ${trusted ? "TRUSTED ✓" : "BLOCKED ✗"} | tx: ${tx.hash}`);
  }

  console.log("\nDone. Add to .env:");
  console.log(`VITE_SLICE_GATE_ADDRESS=${address}`);
  console.log(`SLICE_GATE_ADDRESS=${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
