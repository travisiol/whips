import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const head = await client.getBlockNumber();
console.log("head", head);
// How wide a range does the RPC allow?
for (const span of [1000n, 10000n, 50000n, 200000n]) {
  try {
    const logs = await client.getLogs({ address: FACTORY, fromBlock: head - span, toBlock: head });
    const topics = {};
    for (const l of logs) topics[l.topics[0]] = (topics[l.topics[0]] ?? 0) + 1;
    console.log("span", span, "logs", logs.length, topics);
  } catch (e) { console.log("span", span, "error", e.shortMessage ?? e.message?.slice(0, 200)); }
}
