const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ShadowKeyAttestation with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");

  const Factory = await hre.ethers.getContractFactory("ShadowKeyAttestation");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\nShadowKeyAttestation deployed to:", address);
  console.log("Explorer:", `https://sepolia.explorer.status.network/address/${address}`);
  console.log("\nAdd to .env:");
  console.log(`  VITE_ATTESTATION_CONTRACT_ADDRESS=${address}`);
  console.log(`  ATTESTATION_CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
