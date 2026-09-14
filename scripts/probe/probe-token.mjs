// What a Pons V2 token and the fee escrow expose on chain — selectors read off the bytecode, named via openchain.
import { createPublicClient, http, decodeAbiParameters, parseAbi } from "viem";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const TOPIC = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const head = await client.getBlockNumber();
const logs = await client.getLogs({ address: FACTORY, fromBlock: head - 3000n, toBlock: head });
const last = logs.filter((l) => l.topics[0] === TOPIC).at(-1);
const token = `0x${last.topics[1].slice(26)}`;
const curve = `0x${last.topics[2].slice(26)}`;
console.log("latest launch token", token, "curve", curve);
async function selectors(addr) {
  const code = await client.getCode({ address: addr });
  const set = new Set();
  const re = /63([0-9a-f]{8})(?:14|8114)/g; let m; const hex = code.slice(2);
  while ((m = re.exec(hex))) set.add("0x" + m[1]);
  const list = [...set]; const names = {};
  for (let i = 0; i < list.length; i += 40) {
    const batch = list.slice(i, i + 40);
    const res = await fetch(`https://api.openchain.xyz/signature-database/v1/lookup?function=${batch.join(",")}&filter=true`);
    const json = await res.json();
    for (const [sel, entries] of Object.entries(json.result?.function ?? {})) if (entries?.length) names[sel] = entries.map((e) => e.name).join(" | ");
  }
  return list.map((s) => `${s} ${names[s] ?? "?"}`);
}
console.log("\n== token selectors"); for (const s of await selectors(token)) console.log("  ", s);
console.log("\n== escrow selectors"); for (const s of await selectors(ESCROW)) console.log("  ", s);
// Try metadata-ish views on the token
const tokenAbi = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function logo() view returns (string)", "function description() view returns (string)", "function metadata() view returns (string)", "function tokenURI() view returns (string)", "function image() view returns (string)", "function website() view returns (string)", "function curve() view returns (address)", "function creator() view returns (address)", "function owner() view returns (address)"]);
for (const fn of ["name", "symbol", "logo", "description", "metadata", "tokenURI", "image", "website", "curve", "creator", "owner"]) {
  try { console.log(fn, "=>", String(await client.readContract({ address: token, abi: tokenAbi, functionName: fn })).slice(0, 120)); } catch (e) { console.log(fn, "=> (no such view)"); }
}
