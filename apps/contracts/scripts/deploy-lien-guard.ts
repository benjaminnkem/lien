import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const Registry = await ethers.getContractFactory("ObligationRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ObligationRegistry:", registryAddress);

  const Guard = await ethers.getContractFactory("LienGuard");
  const guard = await Guard.deploy(registryAddress);
  await guard.waitForDeployment();
  const guardAddress = await guard.getAddress();
  console.log("LienGuard:", guardAddress);

  const Token = await ethers.getContractFactory("MockSettlementToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockSettlementToken:", tokenAddress);

  const A = await ethers.getContractFactory("DemoFinanceA");
  const protocolA = await A.deploy(guardAddress, tokenAddress);
  await protocolA.waitForDeployment();
  const protocolAAddress = await protocolA.getAddress();
  console.log("DemoFinanceA:", protocolAAddress);

  const B = await ethers.getContractFactory("DemoFinanceB");
  const protocolB = await B.deploy(guardAddress, tokenAddress);
  await protocolB.waitForDeployment();
  const protocolBAddress = await protocolB.getAddress();
  console.log("DemoFinanceB:", protocolBAddress);

  const Book = await ethers.getContractFactory("PriorityClaimBook");
  const priorityBook = await Book.deploy(guardAddress, registryAddress);
  await priorityBook.waitForDeployment();
  const priorityBookAddress = await priorityBook.getAddress();
  console.log("PriorityClaimBook:", priorityBookAddress);

  const X = await ethers.getContractFactory("CrossChainClearanceMock");
  const xchain = await X.deploy();
  await xchain.waitForDeployment();
  const xchainAddress = await xchain.getAddress();
  console.log("CrossChainClearanceMock:", xchainAddress);

  const liquidity = 1_000_000n * 10n ** 6n;
  await (await protocolA.fundLiquidity(liquidity)).wait();
  await (await protocolB.fundLiquidity(liquidity)).wait();
  console.log("Funded both protocols with", liquidity.toString(), "dUSDC units");

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      ObligationRegistry: registryAddress,
      LienGuard: guardAddress,
      MockSettlementToken: tokenAddress,
      DemoFinanceA: protocolAAddress,
      DemoFinanceB: protocolBAddress,
      PriorityClaimBook: priorityBookAddress,
      CrossChainClearanceMock: xchainAddress,
    },
  };

  const dir = resolve(__dirname, "../deployments");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${network.name}-lienguard.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Wrote", file);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
