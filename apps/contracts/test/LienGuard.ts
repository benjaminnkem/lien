import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type {
  ObligationRegistry,
  LienGuard,
  DemoFinanceA,
  DemoFinanceB,
  MockSettlementToken,
} from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const TERMS_TYPES = {
  ObligationTerms: [
    { name: "supplier", type: "address" },
    { name: "obligor", type: "address" },
    { name: "currency", type: "string" },
    { name: "faceValue", type: "uint256" },
    { name: "dueDate", type: "uint64" },
    { name: "invoiceReference", type: "string" },
    { name: "purchaseOrderReference", type: "string" },
    { name: "jurisdiction", type: "string" },
    { name: "version", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

describe("LIEN P0 — ObligationRegistry + LienGuard + dual protocols", () => {
  let registry: ObligationRegistry;
  let guard: LienGuard;
  let token: MockSettlementToken;
  let protocolA: DemoFinanceA;
  let protocolB: DemoFinanceB;
  let supplier: HardhatEthersSigner;
  let obligor: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let deployer: HardhatEthersSigner;

  const faceValue = 100_000n * 10n ** 6n;
  const financeAmount = 80_000n * 10n ** 6n;

  async function buildTerms(evidenceRoot: string, nonceSeed: string) {
    return {
      supplier: supplier.address,
      obligor: obligor.address,
      currency: "USD",
      faceValue,
      dueDate: BigInt(Math.floor(Date.now() / 1000) + 90 * 86400),
      invoiceReference: "INV-ACME-100",
      purchaseOrderReference: "PO-9001",
      evidenceRoot,
      jurisdiction: "SG",
      version: 1n,
      nonce: ethers.id(nonceSeed),
    };
  }

  async function registerAndConfirm(evidenceRoot: string, nonceSeed: string) {
    const terms = await buildTerms(evidenceRoot, nonceSeed);
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "LIEN ObligationRegistry",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await registry.getAddress(),
    };

    await (await registry.connect(supplier).register(terms)).wait();
    const id = await registry.obligationId(terms);
    // Sign economic identity fields only (evidenceRoot excluded from Obligation ID).
    const signable = {
      supplier: terms.supplier,
      obligor: terms.obligor,
      currency: terms.currency,
      faceValue: terms.faceValue,
      dueDate: terms.dueDate,
      invoiceReference: terms.invoiceReference,
      purchaseOrderReference: terms.purchaseOrderReference,
      jurisdiction: terms.jurisdiction,
      version: terms.version,
      nonce: terms.nonce,
    };
    const signature = await obligor.signTypedData(
      domain,
      TERMS_TYPES,
      signable,
    );
    await (await registry.connect(supplier).confirm(terms, signature)).wait();
    return { terms, id };
  }

  beforeEach(async () => {
    [deployer, supplier, obligor, borrower] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ObligationRegistry");
    registry = (await Registry.deploy()) as unknown as ObligationRegistry;
    await registry.waitForDeployment();

    const Guard = await ethers.getContractFactory("LienGuard");
    guard = (await Guard.deploy(
      await registry.getAddress(),
    )) as unknown as LienGuard;
    await guard.waitForDeployment();

    const Token = await ethers.getContractFactory("MockSettlementToken");
    token = (await Token.deploy()) as unknown as MockSettlementToken;
    await token.waitForDeployment();

    const A = await ethers.getContractFactory("DemoFinanceA");
    protocolA = (await A.deploy(
      await guard.getAddress(),
      await token.getAddress(),
    )) as unknown as DemoFinanceA;
    await protocolA.waitForDeployment();

    const B = await ethers.getContractFactory("DemoFinanceB");
    protocolB = (await B.deploy(
      await guard.getAddress(),
      await token.getAddress(),
    )) as unknown as DemoFinanceB;
    await protocolB.waitForDeployment();

    await (await protocolA.fundLiquidity(financeAmount * 5n)).wait();
    await (await protocolB.fundLiquidity(financeAmount * 5n)).wait();
  });

  it("same economic terms with different evidence roots share Obligation ID", async () => {
    const termsA = await buildTerms(ethers.id("pdf-a"), "shared-nonce");
    const termsB = await buildTerms(ethers.id("pdf-b-modified"), "shared-nonce");
    expect(ethers.id("pdf-a")).to.not.equal(ethers.id("pdf-b-modified"));
    const idA = await registry.obligationId(termsA);
    const idB = await registry.obligationId(termsB);
    expect(idA).to.equal(idB);
  });

  it("Protocol A finances; Protocol B is blocked and moves zero funds", async () => {
    const evidenceA = ethers.id("document-a-bytes");
    const evidenceB = ethers.id("document-b-different-bytes");
    expect(evidenceA).to.not.equal(evidenceB);

    // Canonical demo: one obligation confirmed once.
    const { id } = await registerAndConfirm(evidenceA, "shared-obligation");

    const balBBefore = await token.balanceOf(await protocolB.getAddress());
    const borrowerBefore = await token.balanceOf(borrower.address);

    const expiry = BigInt((await time.latest()) + 3600);
    await (
      await protocolA.finance(id, borrower.address, financeAmount, expiry)
    ).wait();

    const st = await guard.status(id);
    expect(st.state).to.equal(3n); // Encumbered
    expect(st.claimController).to.equal(await protocolA.getAddress());
    expect(st.securedAmount).to.equal(financeAmount);

    const borrowerAfterA = await token.balanceOf(borrower.address);
    expect(borrowerAfterA - borrowerBefore).to.equal(financeAmount);

    await expect(
      protocolB.finance(id, borrower.address, financeAmount, expiry),
    ).to.be.reverted;

    const balBAfter = await token.balanceOf(await protocolB.getAddress());
    expect(balBAfter).to.equal(balBBefore);
    expect(await protocolB.lastAttemptSucceeded()).to.equal(false);

    const borrowerFinal = await token.balanceOf(borrower.address);
    expect(borrowerFinal).to.equal(borrowerAfterA);
  });

  it("two competing reservations: only one succeeds", async () => {
    const { id } = await registerAndConfirm(ethers.id("race-doc"), "race-1");
    const expiry = BigInt((await time.latest()) + 3600);

    await (
      await protocolA.finance(id, borrower.address, financeAmount, expiry)
    ).wait();

    await expect(
      protocolB.finance(id, borrower.address, financeAmount, expiry),
    ).to.be.reverted;
  });

  it("invalid obligor signature fails", async () => {
    const terms = await buildTerms(ethers.id("sig"), "sig-1");
    await (await registry.connect(supplier).register(terms)).wait();
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "LIEN ObligationRegistry",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await registry.getAddress(),
    };
    const signable = {
      supplier: terms.supplier,
      obligor: terms.obligor,
      currency: terms.currency,
      faceValue: terms.faceValue,
      dueDate: terms.dueDate,
      invoiceReference: terms.invoiceReference,
      purchaseOrderReference: terms.purchaseOrderReference,
      jurisdiction: terms.jurisdiction,
      version: terms.version,
      nonce: terms.nonce,
    };
    const badSig = await supplier.signTypedData(domain, TERMS_TYPES, signable);
    await expect(
      registry.connect(supplier).confirm(terms, badSig),
    ).to.be.revertedWithCustomError(registry, "InvalidObligorSignature");
  });

  it("discharge preserves history and allows new reservation", async () => {
    const { id } = await registerAndConfirm(ethers.id("repay"), "repay-1");
    const expiry = BigInt((await time.latest()) + 3600);
    await (
      await protocolA.finance(id, borrower.address, financeAmount, expiry)
    ).wait();

    await (
      await token.connect(borrower).approve(await protocolA.getAddress(), financeAmount)
    ).wait();
    await (
      await protocolA.repay(
        id,
        borrower.address,
        financeAmount,
        ethers.id("repay-ref-1"),
      )
    ).wait();

    const st = await guard.status(id);
    expect(st.state).to.equal(4n); // Discharged
    expect(st.repaymentRef).to.equal(ethers.id("repay-ref-1"));

    // New financing after discharge is allowed
    await (
      await protocolA.finance(id, borrower.address, financeAmount, expiry + 100n)
    ).wait();
    const st2 = await guard.status(id);
    expect(st2.state).to.equal(3n); // Encumbered again
  });

  it("expired reservation returns to financeable verified state", async () => {
    const { id } = await registerAndConfirm(ethers.id("exp"), "exp-1");
    const expiry = BigInt((await time.latest()) + 10);
    // Reserve as an EOA protocol (msg.sender becomes claim controller)
    await (await guard.connect(deployer).reserve(id, financeAmount, expiry)).wait();

    await time.increase(20);
    await (await guard.expireReservation(id)).wait();
    const st = await guard.status(id);
    expect(st.state).to.equal(1n); // Verified
  });

  it("changing material economic term changes obligation id", async () => {
    const a = await buildTerms(ethers.id("e"), "m1");
    const b = { ...a, faceValue: faceValue + 1n, nonce: ethers.id("m2") };
    const idA = await registry.obligationId(a);
    const idB = await registry.obligationId(b);
    expect(idA).to.not.equal(idB);
  });
});
