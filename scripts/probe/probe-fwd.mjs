import { createPublicClient, http, decodeAbiParameters, decodeFunctionData, parseAbi, formatEther } from "viem";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const FWD = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const TOPIC = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const head = await client.getBlockNumber();
const logs = await client.getLogs({ address: FACTORY, fromBlock: head - 200000n, toBlock: head });
const launches = logs.filter((l) => l.topics[0] === TOPIC).map((l) => {
  const [pair] = decodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "uint256" }], l.data);
  return { token: `0x${l.topics[1].slice(26)}`, curve: `0x${l.topics[2].slice(26)}`, sender: `0x${l.topics[3].slice(26)}`, pair, block: l.blockNumber, tx: l.transactionHash };
});
const bySender = new Map();
for (const l of launches) bySender.set(l.sender, (bySender.get(l.sender) ?? 0) + 1);
console.log("top senders", [...bySender.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6));
const viaFwd = launches.filter((l) => l.sender.toLowerCase() === FWD.toLowerCase());
console.log("via forwarder", viaFwd.length, "of which stock-paired", viaFwd.filter((l) => l.pair !== "0x0000000000000000000000000000000000000000").length);
const stockFwd = viaFwd.filter((l) => l.pair !== "0x0000000000000000000000000000000000000000").slice(-3);
const fwdAbi = parseAbi([
  "struct Socials { string x; string telegram; string website; string discord; string extra; }",
  "struct LaunchParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 economicsHash; bytes32 salt; }",
  "function launchAndBuy(LaunchParams params, uint256 configId, address pairToken, uint256 buyAmount, uint256 minTokensOut, address buyRecipient, address[] exempt) payable returns (address, address)",
]);
for (const l of stockFwd) {
  const tx = await client.getTransaction({ hash: l.tx });
  console.log("\ntx", l.tx, "block", l.block, "from", tx.from, "to", tx.to, "value", formatEther(tx.value), "pair", l.pair);
  if (tx.to?.toLowerCase() === FWD.toLowerCase()) {
    try {
      const d = decodeFunctionData({ abi: fwdAbi, data: tx.input });
      const [p, configId, pair, buyAmount, minOut, recipient, exempt] = d.args;
      console.log("  launchAndBuy", { name: p.name, symbol: p.symbol, feeRecipient: p.creatorFeeRecipient, tax: p.creatorTaxBps, buyback: p.buybackEnabled, salt: p.salt, configId, pair, buyAmount: formatEther(buyAmount), minOut, recipient, exempt });
    } catch (e) { console.log("  decode failed", e.shortMessage ?? e.message, "selector", tx.input.slice(0, 10)); }
  } else console.log("  sent to", tx.to, "selector", tx.input.slice(0, 10));
  // token transfer logs in that tx: who paid the pair token?
  const r = await client.getTransactionReceipt({ hash: l.tx });
  for (const lg of r.logs) if (lg.address.toLowerCase() === l.pair.toLowerCase() && lg.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") console.log("  pair Transfer", `0x${lg.topics[1].slice(26)}`, "->", `0x${lg.topics[2].slice(26)}`, formatEther(BigInt(lg.data)));
  for (const lg of r.logs) if (lg.address.toLowerCase() === l.pair.toLowerCase() && lg.topics[0] === "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925") console.log("  pair Approval", `0x${lg.topics[1].slice(26)}`, "->", `0x${lg.topics[2].slice(26)}`, formatEther(BigInt(lg.data)));
}
