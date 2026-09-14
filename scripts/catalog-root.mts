/**
 * Builds the Merkle tree the launcher's catalogRoot commits to and writes
 * src/data/catalog-tree.json (root + a proof per car). Leaves are
 * [itemId, name, symbol, pairToken] hashed the OpenZeppelin StandardMerkleTree
 * way — keccak256(bytes.concat(keccak256(abi.encode(...)))) — which is
 * exactly what WhipsLauncher.leafFor computes on chain.
 *
 *   npm run catalog:root
 *
 * Re-run after any catalog change; a deployed launcher keeps the root it was
 * built with, so a catalog edit after deployment means a new launcher.
 */
import { writeFileSync } from "node:fs";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { CARS, pairOf } from "../src/data/catalog.ts";

const LEAF = ["uint256", "string", "string", "address"] as const;

const values = CARS.map((c) => [BigInt(c.id), c.name, c.ticker, pairOf(c).address] as [bigint, string, string, string]);
const tree = StandardMerkleTree.of(values, [...LEAF]);

const proofs: Record<string, string[]> = {};
for (const [i, v] of tree.entries()) {
  proofs[String(v[0])] = tree.getProof(i);
}

const out = {
  root: tree.root,
  leafEncoding: LEAF,
  count: values.length,
  builtAt: new Date().toISOString(),
  proofs,
};
const file = new URL("../src/data/catalog-tree.json", import.meta.url);
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log("catalogRoot", tree.root, "leaves", values.length, "→", file.pathname);
