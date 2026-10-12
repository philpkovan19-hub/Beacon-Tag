const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);
  const bal = await ethers.provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(bal), "BOT");

  const F = await ethers.getContractFactory("BeaconTag");
  const bt = await F.deploy();
  await bt.waitForDeployment();
  const addr = await bt.getAddress();
  console.log("BeaconTag deployed:", addr);
  console.log("Update CONTRACT_ADDRESS in frontend/index.html");
}

main().catch((e) => { console.error(e); process.exit(1); });
