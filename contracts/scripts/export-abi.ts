import hre from "hardhat";
import { exportAbis } from "./lib/exportAbi";

exportAbis(hre)
  .then(() => console.log("ABI exported to ../src/lib/abi"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
