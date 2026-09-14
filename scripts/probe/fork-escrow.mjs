import { createPublicClient, http, parseAbi, formatEther } from "viem";
const client = createPublicClient({ transport: http("http://127.0.0.1:8556") });
const escrow = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const who = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const [pending, bal, head] = await Promise.all([client.readContract({ address: escrow, abi, functionName: "balanceOf", args: [who] }), client.getBalance({ address: who }), client.getBlockNumber()]);
const block = await client.getBlock({ blockNumber: head, includeTransactions: true });
console.log({ head: Number(head), pendingInEscrow: formatEther(pending), walletEth: formatEther(bal), lastBlockTxs: block.transactions.map((t) => ({ hash: t.hash, from: t.from, to: t.to, input: t.input.slice(0, 10) })) });
