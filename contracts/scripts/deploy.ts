import * as fs from "fs";
import * as path from "path";
import { ethers, network } from "hardhat";
import { deploymentsDir, type DeploymentRecord } from "./lib/exportAbi";

/** Pons V2 factory on Robinhood Chain (chain id 4663). */
const PONS_FACTORY_ROBINHOOD = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/**
 * Deploys WhipsLauncher against the Pons V2 factory with the catalog root
 * from ../src/data/catalog-tree.json (run `npm run catalog:root` at the
 * repo root first). On the hardhat network the Pons mock stands in so the
 * script can be rehearsed end to end.
 *
 *   PONS_FACTORY_ADDRESS   factory (defaults to the Robinhood Chain one)
 *   CATALOG_ROOT           override the root (defaults to catalog-tree.json)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const isLocal = network.name === "hardhat" || network.name === "localhost";

  const treeFile = path.resolve(__dirname, "../../src/data/catalog-tree.json");
  const tree = JSON.parse(fs.readFileSync(treeFile, "utf8")) as { root: string; count: number };
  const root = env("CATALOG_ROOT") ?? tree.root;

  console.log(`Network   : ${network.name} (chainId ${chainId})`);
  console.log(`Deployer  : ${deployer.address}`);
  console.log(`Root      : ${root} (${tree.count} cars)`);

  let factory = env("PONS_FACTORY_ADDRESS");
  if (!factory) {
    if (isLocal) {
      const mock = await (await ethers.getContractFactory("MockPonsFactory")).deploy();
      await mock.waitForDeployment();
      const fwd = await (await ethers.getContractFactory("MockLaunchForwarder")).deploy(await mock.getAddress());
      await mock.setForwarder(await fwd.getAddress());
      factory = await mock.getAddress();
      console.log(`MockPonsFactory : ${factory}`);
    } else if (chainId === 4663) {
      factory = PONS_FACTORY_ROBINHOOD;
    } else {
      throw new Error("PONS_FACTORY_ADDRESS is required on this network.");
    }
  }
  console.log(`Pons factory : ${factory}`);

  const launcher = await (await ethers.getContractFactory("WhipsLauncher")).deploy(factory, root);
  const receipt = await launcher.deploymentTransaction()?.wait();
  await launcher.waitForDeployment();
  const address = await launcher.getAddress();
  console.log(`WhipsLauncher : ${address}`);

  const f = new ethers.Contract(factory, ["function feeEscrow() view returns (address)"], ethers.provider);
  let feeEscrow = ethers.ZeroAddress;
  try {
    feeEscrow = await f.feeEscrow();
  } catch {
    /* mock has none */
  }
  const record: DeploymentRecord = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    ponsFactory: factory,
    ponsForwarder: await launcher.forwarder(),
    feeEscrow,
    launcher: address,
    catalogRoot: root,
    catalogSize: tree.count,
    deployBlock: receipt?.blockNumber ?? 0,
    deployedAt: new Date().toISOString(),
    txHash: receipt?.hash ?? null,
  };
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const file = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  console.log(`Saved ${file}`);
  console.log(`\nFront end: NEXT_PUBLIC_WHIPS_LAUNCHER=${address}  NEXT_PUBLIC_WHIPS_DEPLOY_BLOCK=${record.deployBlock}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
