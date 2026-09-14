import { createPublicClient, http, decodeAbiParameters, parseAbi, formatEther } from "viem";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const TOPIC = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const erc20 = parseAbi(["function symbol() view returns (string)", "function name() view returns (string)", "function decimals() view returns (uint8)"]);
const curveAbi = parseAbi(["function pairToken() view returns (address)", "function graduationThreshold() view returns (uint256)", "function deployer() view returns (address)"]);
const head = await client.getBlockNumber();
const logs = await client.getLogs({ address: FACTORY, fromBlock: head - 200000n, toBlock: head, event: undefined });
const launches = logs.filter((l) => l.topics[0] === TOPIC).map((l) => {
  const [a, b, c] = decodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }], l.data);
  return { token: `0x${l.topics[1].slice(26)}`, curve: `0x${l.topics[2].slice(26)}`, sender: `0x${l.topics[3].slice(26)}`, d0: a, d1: b, d2: c, block: l.blockNumber, tx: l.transactionHash };
});
console.log("launches", launches.length);
// cross-check: is data[0] the pair token? read curve.pairToken() on a few
const sample = launches.slice(-3);
for (const s of sample) {
  const pt = await client.readContract({ address: s.curve, abi: curveAbi, functionName: "pairToken" }).catch((e) => "err " + e.shortMessage);
  const dep = await client.readContract({ address: s.curve, abi: curveAbi, functionName: "deployer" }).catch((e) => "err " + e.shortMessage);
  console.log("curve", s.curve, "data0", s.d0, "pairToken()", pt, "deployer()", dep, "d1", s.d1, "d2", formatEther(s.d2));
}
// distinct data0 values with counts
const counts = new Map();
for (const l of launches) counts.set(l.d0.toLowerCase(), (counts.get(l.d0.toLowerCase()) ?? 0) + 1);
console.log("distinct data0", counts.size);
const rows = [];
for (const [addr, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  if (addr === "0x0000000000000000000000000000000000000000") { rows.push({ addr, n, symbol: "ETH (native)" }); continue; }
  const symbol = await client.readContract({ address: addr, abi: erc20, functionName: "symbol" }).catch(() => "?");
  const name = await client.readContract({ address: addr, abi: erc20, functionName: "name" }).catch(() => "?");
  const decimals = await client.readContract({ address: addr, abi: erc20, functionName: "decimals" }).catch(() => "?");
  rows.push({ addr, n, symbol, name, decimals });
}
for (const r of rows) console.log(r.n.toString().padStart(5), r.addr, r.symbol, r.name ?? "", r.decimals ?? "");
// distinct d1 (configId?) values
const d1s = new Map();
for (const l of launches) d1s.set(l.d1.toString(), (d1s.get(l.d1.toString()) ?? 0) + 1);
console.log("d1 values", [...d1s.entries()]);
const d2s = new Map();
for (const l of launches) d2s.set(formatEther(l.d2), (d2s.get(formatEther(l.d2)) ?? 0) + 1);
console.log("d2 values", [...d2s.entries()].slice(0, 12));
