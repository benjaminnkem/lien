import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set DEPLOYER_PRIVATE_KEY in apps/contracts/.env",
    );
  }

  console.log("Network:", network.name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has zero balance — fund Sepolia ETH first");
  }

  const factory = await ethers.getContractFactory("EncumbranceRegistry");
  const registry = await factory.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const tx = registry.deploymentTransaction();

  console.log("EncumbranceRegistry deployed to:", address);
  if (tx?.hash) {
    console.log("Deploy tx:", tx.hash);
    if (network.name === "sepolia") {
      console.log(`Explorer: https://sepolia.etherscan.io/address/${address}`);
      console.log(`Tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
