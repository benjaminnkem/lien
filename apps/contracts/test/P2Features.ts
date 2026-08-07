import { expect } from "chai";
import { ethers } from "hardhat";
import type {
  ObligationRegistry,
  LienGuard,
  PriorityClaimBook,
  CrossChainClearanceMock,
  DemoFinanceA,
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

describe("LIEN P2 — priority claims + cross-chain mock", () => {
  let registry: ObligationRegistry;
  let guard: LienGuard;
  let book: PriorityClaimBook;
  let xchain: CrossChainClearanceMock;
  let protocolA: DemoFinanceA;
  let token: MockSettlementToken;
  let supplier: HardhatEthersSigner;
  let obligor: HardhatEthersSigner;
  let junior: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;

  const faceValue = 100_000n * 10n ** 6n;
  const financeAmount = 80_000n * 10n ** 6n;

  async function registerAndConfirm(nonceSeed: string) {
    const terms = {
      supplier: supplier.address,
      obligor: obligor.address,
      currency: "USD",
      faceValue,
      dueDate: BigInt(Math.floor(Date.now() / 1000) + 90 * 86400),
      invoiceReference: "INV-P2-1",
      purchaseOrderReference: "PO-P2",
      evidenceRoot: ethers.id("evidence-p2"),
      jurisdiction: "SG",
      version: 1n,
      nonce: ethers.id(nonceSeed),
    };
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "LIEN ObligationRegistry",
      version: "1",
      chainId: network.chainId,
      verifyingContract: await registry.getAddress(),
    };
    await (await registry.connect(supplier).register(terms)).wait();
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
    const id = await registry.obligationId(terms);
    return { terms, id };
  }

  beforeEach(async () => {
    [, supplier, obligor, junior, borrower] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ObligationRegistry");
    registry = (await Registry.deploy()) as unknown as ObligationRegistry;
    await registry.waitForDeployment();

    const Guard = await ethers.getContractFactory("LienGuard");
    guard = (await Guard.deploy(
      await registry.getAddress(),
    )) as unknown as LienGuard;
    await guard.waitForDeployment();

    const Book = await ethers.getContractFactory("PriorityClaimBook");
    book = (await Book.deploy(
      await guard.getAddress(),
      await registry.getAddress(),
    )) as unknown as PriorityClaimBook;
    await book.waitForDeployment();

    const X = await ethers.getContractFactory("CrossChainClearanceMock");
    xchain = (await X.deploy()) as unknown as CrossChainClearanceMock;
    await xchain.waitForDeployment();

    const Token = await ethers.getContractFactory("MockSettlementToken");
    token = (await Token.deploy()) as unknown as MockSettlementToken;
    await token.waitForDeployment();

    const A = await ethers.getContractFactory("DemoFinanceA");
    protocolA = (await A.deploy(
      await guard.getAddress(),
      await token.getAddress(),
    )) as unknown as DemoFinanceA;
    await protocolA.waitForDeployment();
    await (await protocolA.fundLiquidity(financeAmount * 5n)).wait();
  });

  it("registers subordinate claims with unique ranks (protocol-level only)", async () => {
    const { id } = await registerAndConfirm("p2-sub-1");
    const claimId = await book
      .connect(junior)
      .registerSubordinate.staticCall(
        id,
        1,
        20_000n * 10n ** 6n,
        ethers.id("junior-ref"),
        "mezz-facility",
      );
    await (
      await book
        .connect(junior)
        .registerSubordinate(
          id,
          1,
          20_000n * 10n ** 6n,
          ethers.id("junior-ref"),
          "mezz-facility",
        )
    ).wait();

    const claims = await book.getClaims(id);
    expect(claims.length).to.equal(1);
    expect(claims[0].priorityRank).to.equal(1);
    expect(claims[0].protocol).to.equal(junior.address);
    expect(claims[0].claimId).to.equal(claimId);

    await expect(
      book
        .connect(junior)
        .registerSubordinate(
          id,
          1,
          1n,
          ethers.id("dup"),
          "dup-rank",
        ),
    ).to.be.revertedWithCustomError(book, "RankAlreadyTaken");

    await expect(
      book
        .connect(junior)
        .registerSubordinate(id, 0, 1n, ethers.id("senior"), "bad"),
    ).to.be.revertedWithCustomError(book, "InvalidRank");
  });

  it("subordinate claims can coexist with exclusive encumbrance", async () => {
    const { id } = await registerAndConfirm("p2-sub-2");
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
    await (
      await protocolA.finance(id, borrower.address, financeAmount, expiry)
    ).wait();
    const st = await guard.status(id);
    expect(st.state).to.equal(3n); // Encumbered

    await (
      await book
        .connect(junior)
        .registerSubordinate(
          id,
          2,
          10_000n * 10n ** 6n,
          ethers.id("j2"),
          "disclosed-junior",
        )
    ).wait();
    expect(await book.activeSubordinateCount(id)).to.equal(1n);

    const [senior, juniors] = await book.prioritySnapshot(id);
    expect(senior.state).to.equal(3n);
    expect(juniors.length).to.equal(1);
  });

  it("only claim protocol can release subordinate claim", async () => {
    const { id } = await registerAndConfirm("p2-sub-3");
    await (
      await book
        .connect(junior)
        .registerSubordinate(
          id,
          1,
          5_000n * 10n ** 6n,
          ethers.id("r1"),
          "j1",
        )
    ).wait();
    const claims = await book.getClaims(id);
    const claimId = claims[0].claimId;

    await expect(
      book.connect(supplier).releaseSubordinate(claimId),
    ).to.be.revertedWithCustomError(book, "NotClaimProtocol");

    await (await book.connect(junior).releaseSubordinate(claimId)).wait();
    expect(await book.activeSubordinateCount(id)).to.equal(0n);
  });

  it("cross-chain mock posts and one-time consumes clearance", async () => {
    const { id } = await registerAndConfirm("p2-xchain-1");
    const hash = ethers.id("clearance-payload");
    const targetChain = 10_142n; // mock Monad-ish id for architecture demo

    const recordId = await xchain
      .connect(junior)
      .postClearance.staticCall(id, targetChain, hash);
    await (
      await xchain.connect(junior).postClearance(id, targetChain, hash)
    ).wait();

    const rec = await xchain.getRecord(recordId);
    expect(rec.obligationId).to.equal(id);
    expect(rec.targetChainId).to.equal(targetChain);
    expect(rec.active).to.equal(true);
    expect(rec.consumed).to.equal(false);

    await (await xchain.connect(borrower).consumeClearance(recordId)).wait();
    const after = await xchain.getRecord(recordId);
    expect(after.consumed).to.equal(true);
    expect(after.active).to.equal(false);

    await expect(
      xchain.connect(borrower).consumeClearance(recordId),
    ).to.be.revertedWithCustomError(xchain, "AlreadyConsumed");
  });
});
