import { createPublicClient, http, decodeAbiParameters, decodeFunctionData, parseAbi, formatEther } from "viem";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const FWD = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const TOPIC = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const head = await client.getBlockNumber();
const logs = await client.getLogs({ address: FACTORY, fromBlock: head - 60000n, toBlock: head });
const launches = logs.filter((l) => l.topics[0] === TOPIC).map((l) => {
  const [pair] = decodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }], l.data);
  return { token: `0x${l.topics[1].slice(26)}`, curve: `0x${l.topics[2].slice(26)}`, pair, block: l.blockNumber, tx: l.transactionHash };
});
const stock = launches.filter((l) => l.pair !== "0x0000000000000000000000000000000000000000");
console.log("launches", launches.length, "stock-paired", stock.length);
const toCounts = new Map();
const fwdStock = [];
const fwdEth = [];
const txCache = new Map();
for (const l of stock.slice(-60)) {
  const tx = await client.getTransaction({ hash: l.tx });
  txCache.set(l.tx, tx);
  const to = tx.to?.toLowerCase();
  toCounts.set(to, (toCounts.get(to) ?? 0) + 1);
  if (to === FWD.toLowerCase()) fwdStock.push({ ...l, tx });
}
console.log("stock launch tx targets", [...toCounts.entries()]);
for (const l of launches.filter((l) => l.pair === "0x0000000000000000000000000000000000000000").slice(-40)) {
  const tx = await client.getTransaction({ hash: l.tx });
  if (tx.to?.toLowerCase() === FWD.toLowerCase()) fwdEth.push({ ...l, tx });
}
console.log("eth launches via forwarder among last 40:", fwdEth.length);
const fwdAbi = parseAbi([
  "struct Socials { string x; string telegram; string website; string discord; string extra; }",
  "struct LaunchParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 economicsHash; bytes32 salt; }",
  "function launchAndBuy(LaunchParams params, uint256 configId, address pairToken, uint256 buyAmount, uint256 minTokensOut, address buyRecipient, address[] exempt) payable returns (address, address)",
]);
const show = async (l) => {
  const tx = l.tx;
  console.log("\ntx", tx.hash, "block", l.block, "from", tx.from, "value", formatEther(tx.value), "pair", l.pair, "selector", tx.input.slice(0, 10));
  try {
    const d = decodeFunctionData({ abi: fwdAbi, data: tx.input });
    const [p, configId, pair, buyAmount, minOut, recipient, exempt] = d.args;
    console.log("  launchAndBuy", { name: p.name, symbol: p.symbol, feeRecipient: p.creatorFeeRecipient, tax: p.creatorTaxBps, buyback: p.buybackEnabled, economicsHash: p.economicsHash, salt: p.salt, configId, pair, buyAmount: formatEther(buyAmount), minOut, recipient, exempt });
  } catch (e) { console.log("  decode failed", e.shortMessage ?? e.message); }
  const r = await client.getTransactionReceipt({ hash: tx.hash });
  for (const lg of r.logs) {
    if (lg.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") console.log("  Transfer", lg.address, `0x${lg.topics[1].slice(26)}`, "->", `0x${lg.topics[2].slice(26)}`, formatEther(BigInt(lg.data)));
    if (lg.topics[0] === "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925") console.log("  Approval", lg.address, `0x${lg.topics[1].slice(26)}`, "->", `0x${lg.topics[2].slice(26)}`, formatEther(BigInt(lg.data)));
  }
};
for (const l of fwdStock.slice(-2)) await show(l);
for (const l of fwdEth.slice(-1)) await show(l);
