import { createPublicClient, http, getContractAddress, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// Mirrors contracts/scripts/serve-fork.ts: the rehearsal deployer is derived
// from a fixed string and never used on mainnet, so its nonce there is 0.
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const from = privateKeyToAccount(keccak256(toBytes("whips rehearsal deployer"))).address;
const [nonce, head] = await Promise.all([client.getTransactionCount({ address: from }), client.getBlockNumber()]);
console.log(JSON.stringify({ deployer: from, nonce, head: Number(head), launcher: getContractAddress({ from, nonce: BigInt(nonce) }) }));
