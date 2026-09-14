import { HardhatUserConfig, task } from "hardhat/config";
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { exportAbis } from "./scripts/lib/exportAbi";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** Robinhood Chain (Arbitrum Orbit). Chain id 4663 (0x1237). */
const ROBINHOOD_RPC_URL = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const ROBINHOOD_CHAIN_ID = Number(process.env.ROBINHOOD_CHAIN_ID ?? 4663);

/**
 * Every successful `hardhat compile` re-exports the launcher ABI into
 * ../src/lib/abi so the front end can never drift from the contract.
 * SKIP_ABI_EXPORT=true opts out.
 */
task(TASK_COMPILE, async (args, hre, runSuper) => {
  const result = await runSuper(args);
  if (process.env.SKIP_ABI_EXPORT !== "true") {
    await exportAbis(hre);
  }
  return result;
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // launch() takes the twelve fields the brief names as flat arguments;
      // that only fits on the stack through the IR pipeline.
      viaIR: true,
      ...(process.env.SOLIDITY_EVM_VERSION ? { evmVersion: process.env.SOLIDITY_EVM_VERSION } : {}),
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // FORK_URL=https://rpc.mainnet.chain.robinhood.com turns the in-process
      // network into a fork of Robinhood Chain (optionally pinned with
      // FORK_BLOCK). scripts/fork-check.ts, probe-pairs.ts and serve-fork.ts
      // all run this way — the public RPC keeps little history, so an
      // in-process fork that caches everything in one pass is the reliable
      // option (a long-lived `hardhat node --fork` starts failing reads).
      ...(process.env.FORK_URL
        ? {
            forking: {
              url: process.env.FORK_URL,
              ...(process.env.FORK_BLOCK ? { blockNumber: Number(process.env.FORK_BLOCK) } : {}),
            },
          }
        : {}),
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 600_000,
    },
    robinhood: {
      url: ROBINHOOD_RPC_URL,
      chainId: ROBINHOOD_CHAIN_ID,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      robinhood: process.env.ROBINHOOD_EXPLORER_API_KEY ?? "no-key-required",
    },
    customChains: [
      {
        network: "robinhood",
        chainId: ROBINHOOD_CHAIN_ID,
        urls: {
          apiURL: process.env.ROBINHOOD_EXPLORER_API_URL ?? "https://robinhoodchain.blockscout.com/api",
          browserURL: process.env.ROBINHOOD_EXPLORER_URL ?? "https://robinhoodchain.blockscout.com",
        },
      },
    ],
  },
  sourcify: { enabled: false },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 600_000,
  },
};

export default config;
