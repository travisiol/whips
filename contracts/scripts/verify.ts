import * as fs from "fs";
import * as path from "path";
import { run, network } from "hardhat";
import { deploymentsDir, type DeploymentRecord } from "./lib/exportAbi";

/** Verifies the deployed launcher on Blockscout, from the deployment record. */
async function main() {
  const file = path.join(deploymentsDir, `${network.name}.json`);
  const record = JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentRecord;
  await run("verify:verify", {
    address: record.launcher,
    constructorArguments: [record.ponsFactory, record.catalogRoot],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
