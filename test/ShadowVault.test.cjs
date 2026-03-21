const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShadowVault", function () {
  let vault, owner, other;
  const CATEGORY_PAYMENT = 0;
  const CATEGORY_IDENTITY = 1;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const ShadowVault = await ethers.getContractFactory("ShadowVault");
    vault = await ShadowVault.deploy();
    await vault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the deployer as owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("starts with no lockdown", async function () {
      expect(await vault.isLockedDown()).to.equal(false);
    });

    it("starts with zero policies", async function () {
      expect(await vault.getPolicyCount()).to.equal(0);
    });
  });

  describe("Policy Registration", function () {
    const policyId = ethers.keccak256(ethers.toUtf8Bytes("policy-uuid-1"));
    const detailsHash = ethers.keccak256(ethers.toUtf8Bytes("details"));
    let agentAddress, futureTimestamp;

    beforeEach(async function () {
      agentAddress = other.address;
      futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // +1 day
    });

    it("registers a policy", async function () {
      const tx = await vault.registerPolicy(
        policyId, agentAddress, CATEGORY_PAYMENT,
        5000, 50000, futureTimestamp, detailsHash
      );

      await expect(tx).to.emit(vault, "PolicyRegistered")
        .withArgs(policyId, agentAddress, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash);

      expect(await vault.getPolicyCount()).to.equal(1);

      const policy = await vault.getPolicy(policyId);
      expect(policy.agentAddress).to.equal(agentAddress);
      expect(policy.active).to.equal(true);
      expect(policy.totalSpent).to.equal(0);
    });

    it("rejects duplicate policy IDs", async function () {
      await vault.registerPolicy(policyId, agentAddress, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash);
      await expect(
        vault.registerPolicy(policyId, agentAddress, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash)
      ).to.be.revertedWith("Policy already exists");
    });

    it("rejects zero agent address", async function () {
      await expect(
        vault.registerPolicy(policyId, ethers.ZeroAddress, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash)
      ).to.be.revertedWith("Invalid agent address");
    });

    it("rejects past expiry", async function () {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      await expect(
        vault.registerPolicy(policyId, agentAddress, CATEGORY_PAYMENT, 5000, 50000, pastTimestamp, detailsHash)
      ).to.be.revertedWith("Expiry must be in future");
    });

    it("rejects non-owner", async function () {
      await expect(
        vault.connect(other).registerPolicy(policyId, agentAddress, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash)
      ).to.be.revertedWith("Not vault owner");
    });
  });

  describe("Policy Revocation", function () {
    const policyId = ethers.keccak256(ethers.toUtf8Bytes("policy-uuid-2"));
    const detailsHash = ethers.keccak256(ethers.toUtf8Bytes("details"));

    beforeEach(async function () {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
      await vault.registerPolicy(policyId, other.address, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash);
    });

    it("revokes an active policy", async function () {
      const tx = await vault.revokePolicy(policyId);
      await expect(tx).to.emit(vault, "PolicyRevoked");

      const policy = await vault.getPolicy(policyId);
      expect(policy.active).to.equal(false);
    });

    it("rejects revoking an already-revoked policy", async function () {
      await vault.revokePolicy(policyId);
      await expect(vault.revokePolicy(policyId)).to.be.revertedWith("Policy not active");
    });
  });

  describe("Disclosure Logging", function () {
    const policyId = ethers.keccak256(ethers.toUtf8Bytes("policy-uuid-3"));
    const detailsHash = ethers.keccak256(ethers.toUtf8Bytes("details"));
    const disclosureHash = ethers.keccak256(ethers.toUtf8Bytes("disclosure-data"));
    let serviceAddress;

    beforeEach(async function () {
      serviceAddress = ethers.Wallet.createRandom().address;
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
      await vault.registerPolicy(policyId, other.address, CATEGORY_PAYMENT, 5000, 50000, futureTimestamp, detailsHash);
    });

    it("logs a disclosure and updates totalSpent", async function () {
      const tx = await vault.logDisclosure(policyId, serviceAddress, 2500, disclosureHash);
      await expect(tx).to.emit(vault, "DisclosureLogged");

      const policy = await vault.getPolicy(policyId);
      expect(policy.totalSpent).to.equal(2500);
    });

    it("rejects disclosure exceeding per-txn limit", async function () {
      await expect(
        vault.logDisclosure(policyId, serviceAddress, 6000, disclosureHash)
      ).to.be.revertedWith("Exceeds per-txn limit");
    });

    it("rejects disclosure exceeding total limit", async function () {
      // 10 disclosures of 5000 = 50000
      for (let i = 0; i < 10; i++) {
        await vault.logDisclosure(policyId, serviceAddress, 5000, disclosureHash);
      }
      await expect(
        vault.logDisclosure(policyId, serviceAddress, 100, disclosureHash)
      ).to.be.revertedWith("Exceeds total limit");
    });

    it("rejects disclosure on revoked policy", async function () {
      await vault.revokePolicy(policyId);
      await expect(
        vault.logDisclosure(policyId, serviceAddress, 100, disclosureHash)
      ).to.be.revertedWith("Policy not active");
    });
  });

  describe("Budget", function () {
    it("updates and reads a budget", async function () {
      const tx = await vault.updateBudget(CATEGORY_IDENTITY, 10, 50, 5, 100000, 80);
      await expect(tx).to.emit(vault, "BudgetUpdated");

      const budget = await vault.getBudget(CATEGORY_IDENTITY);
      expect(budget.maxDisclosuresPerDay).to.equal(10);
      expect(budget.maxDisclosuresPerWeek).to.equal(50);
      expect(budget.maxSpendPerDay).to.equal(100000);
      expect(budget.alertThresholdPct).to.equal(80);
    });
  });

  describe("Emergency Lockdown", function () {
    const policyId1 = ethers.keccak256(ethers.toUtf8Bytes("p1"));
    const policyId2 = ethers.keccak256(ethers.toUtf8Bytes("p2"));
    const detailsHash = ethers.keccak256(ethers.toUtf8Bytes("d"));

    beforeEach(async function () {
      const ts = Math.floor(Date.now() / 1000) + 86400;
      await vault.registerPolicy(policyId1, other.address, CATEGORY_PAYMENT, 5000, 50000, ts, detailsHash);
      await vault.registerPolicy(policyId2, other.address, CATEGORY_IDENTITY, 0, 0, ts, detailsHash);
    });

    it("revokes all active policies and locks down", async function () {
      const tx = await vault.emergencyLockdown("Security breach detected");
      await expect(tx).to.emit(vault, "EmergencyLockdown").withArgs(2, await getBlockTimestamp(tx), "Security breach detected");

      expect(await vault.isLockedDown()).to.equal(true);

      const p1 = await vault.getPolicy(policyId1);
      const p2 = await vault.getPolicy(policyId2);
      expect(p1.active).to.equal(false);
      expect(p2.active).to.equal(false);
    });

    it("blocks new policies during lockdown", async function () {
      await vault.emergencyLockdown("test");
      const policyId3 = ethers.keccak256(ethers.toUtf8Bytes("p3"));
      const ts = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        vault.registerPolicy(policyId3, other.address, CATEGORY_PAYMENT, 0, 0, ts, detailsHash)
      ).to.be.revertedWith("Vault is in lockdown");
    });

    it("lifts lockdown", async function () {
      await vault.emergencyLockdown("test");
      const tx = await vault.liftLockdown();
      await expect(tx).to.emit(vault, "LockdownLifted");
      expect(await vault.isLockedDown()).to.equal(false);
    });

    it("rejects double lockdown", async function () {
      await vault.emergencyLockdown("test");
      await expect(vault.emergencyLockdown("again")).to.be.revertedWith("Already locked down");
    });
  });
});

async function getBlockTimestamp(tx) {
  const receipt = await tx.wait();
  const block = await receipt.provider.getBlock(receipt.blockNumber);
  return block.timestamp;
}
