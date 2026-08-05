import { expect } from "chai";
import { ethers } from "hardhat";
import type { EncumbranceRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("EncumbranceRegistry", () => {
  let registry: EncumbranceRegistry;
  let registrar: HardhatEthersSigner;
  let lenderA: HardhatEthersSigner;
  let lenderB: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const fingerprint = ethers.id("INV-2026-0001|acme|buyer|100000");
  const otherFingerprint = ethers.id("INV-2026-0002|acme|buyer|50000");

  beforeEach(async () => {
    [registrar, lenderA, lenderB, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("EncumbranceRegistry");
    registry = (await factory.deploy()) as unknown as EncumbranceRegistry;
    await registry.waitForDeployment();
  });

  describe("registerLien", () => {
    it("registers a first-priority lien on a clean fingerprint", async () => {
      const tx = await registry
        .connect(registrar)
        .registerLien(fingerprint, lenderA.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(registry, "LienRegistered")
        .withArgs(
          fingerprint,
          lenderA.address,
          registrar.address,
          block!.timestamp,
        );

      expect(await registry.isEncumbered(fingerprint)).to.equal(true);
      expect(await registry.getLender(fingerprint)).to.equal(lenderA.address);

      const lien = await registry.getLien(fingerprint);
      expect(lien.lender).to.equal(lenderA.address);
      expect(lien.active).to.equal(true);
      expect(lien.registeredAt).to.equal(block!.timestamp);
    });

    it("reverts when the same fingerprint is financed again", async () => {
      await registry
        .connect(registrar)
        .registerLien(fingerprint, lenderA.address);

      await expect(
        registry.connect(stranger).registerLien(fingerprint, lenderB.address),
      )
        .to.be.revertedWithCustomError(registry, "AlreadyEncumbered")
        .withArgs(fingerprint, lenderA.address);
    });

    it("allows independent liens on different fingerprints", async () => {
      await registry
        .connect(registrar)
        .registerLien(fingerprint, lenderA.address);
      await registry
        .connect(registrar)
        .registerLien(otherFingerprint, lenderB.address);

      expect(await registry.getLender(fingerprint)).to.equal(lenderA.address);
      expect(await registry.getLender(otherFingerprint)).to.equal(
        lenderB.address,
      );
    });

    it("reverts on zero fingerprint", async () => {
      await expect(
        registry.registerLien(ethers.ZeroHash, lenderA.address),
      ).to.be.revertedWithCustomError(registry, "ZeroFingerprint");
    });

    it("reverts on zero lender", async () => {
      await expect(
        registry.registerLien(fingerprint, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("releaseLien", () => {
    beforeEach(async () => {
      await registry
        .connect(registrar)
        .registerLien(fingerprint, lenderA.address);
    });

    it("lets the lender release and re-open the fingerprint", async () => {
      const tx = await registry.connect(lenderA).releaseLien(fingerprint);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(registry, "LienReleased")
        .withArgs(
          fingerprint,
          lenderA.address,
          lenderA.address,
          block!.timestamp,
        );

      expect(await registry.isEncumbered(fingerprint)).to.equal(false);
      expect(await registry.getLender(fingerprint)).to.equal(ethers.ZeroAddress);

      await registry
        .connect(registrar)
        .registerLien(fingerprint, lenderB.address);
      expect(await registry.getLender(fingerprint)).to.equal(lenderB.address);
    });

    it("reverts if a non-lender tries to release", async () => {
      await expect(registry.connect(stranger).releaseLien(fingerprint))
        .to.be.revertedWithCustomError(registry, "NotAuthorized")
        .withArgs(fingerprint, stranger.address);
    });

    it("reverts if there is no active lien", async () => {
      await expect(
        registry.connect(lenderA).releaseLien(otherFingerprint),
      )
        .to.be.revertedWithCustomError(registry, "NotEncumbered")
        .withArgs(otherFingerprint);
    });
  });

  describe("views on clean fingerprints", () => {
    it("reports not encumbered with empty lien fields", async () => {
      expect(await registry.isEncumbered(fingerprint)).to.equal(false);
      const lien = await registry.getLien(fingerprint);
      expect(lien.lender).to.equal(ethers.ZeroAddress);
      expect(lien.active).to.equal(false);
      expect(lien.registeredAt).to.equal(0);
    });
  });
});
