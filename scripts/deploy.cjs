const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ShadowVault with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const ShadowVault = await hre.ethers.getContractFactory("ShadowVault");
  const vault = await ShadowVault.deploy();
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("\n✓ ShadowVault deployed to:", address);
  console.log("\nAdd to your .env:");
  console.log(`  VITE_SHADOW_VAULT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
