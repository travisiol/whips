import { createPublicClient, http } from "viem";
import { robinhoodChain } from "@/lib/chain";

/**
 * Server-side reader for Robinhood Chain. Multicall3 is deployed at the
 * canonical address there, so viem batches every view into one request.
 */
let client: ReturnType<typeof createPublicClient> | null = null;

export function chainClient() {
  if (!client) {
    client = createPublicClient({
      chain: robinhoodChain,
      transport: http(undefined, { batch: true }),
      batch: { multicall: true },
    });
  }
  return client;
}
