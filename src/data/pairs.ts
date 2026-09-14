/**
 * Pair tokens a car can be launched against.
 *
 * ETH is Pons' native curve (pairToken = address(0)). The three stock
 * tokens were READ FROM THE CHAIN, never guessed: TokenLaunched logs of the
 * Pons V2 factory (0x7eD5…EC7e, last 200k blocks on 2026-09-14) decoded to
 * their pair-token field, then `symbol()` / `name()` / `decimals()` called
 * on each address. All three are "• Robinhood Token" ERC-20s with 18
 * decimals, and every launch on the factory — stock-paired included — used
 * launch config 0. A TSLA-paired launch through our launcher is replayed on
 * a fork in contracts/scripts/fork-check.ts.
 */
export type PairSymbol = "ETH" | "TSLA" | "F" | "RIVN";

export type Pair = {
  symbol: PairSymbol;
  /** address(0) for native ETH. */
  address: `0x${string}`;
  name: string;
  decimals: number;
  /** The maker whose cars pair against this token; ETH takes everyone else. */
  maker: string | null;
  /** How the address was established. */
  evidence: string;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const PAIRS: Record<PairSymbol, Pair> = {
  ETH: {
    symbol: "ETH",
    address: ZERO_ADDRESS,
    name: "Ether",
    decimals: 18,
    maker: null,
    evidence: "native curve, pairToken = address(0)",
  },
  TSLA: {
    symbol: "TSLA",
    address: "0x322f0929c4625ed5bad873c95208d54e1c003b2d",
    name: "Tesla • Robinhood Token",
    decimals: 18,
    maker: "Tesla",
    evidence: "pair-token field of 28 TokenLaunched logs; symbol()/name() read on chain 2026-09-14",
  },
  F: {
    symbol: "F",
    address: "0x25c288e6d899b9bc30160965ad9644c67e73be0c",
    name: "Ford Motor • Robinhood Token",
    decimals: 18,
    maker: "Ford",
    evidence: "pair-token field of a TokenLaunched log; symbol()/name() read on chain 2026-09-14",
  },
  RIVN: {
    symbol: "RIVN",
    address: "0xb1bf26c1d20ff267a4f93550d1e0d06ac40a114b",
    name: "Rivian Automotive • Robinhood Token",
    decimals: 18,
    maker: "Rivian",
    evidence: "pair-token field of a TokenLaunched log; symbol()/name() read on chain 2026-09-14",
  },
};

/** Which pair a maker launches against. Everyone not listed pairs with ETH. */
export function pairForMaker(maker: string): Pair {
  for (const pair of Object.values(PAIRS)) {
    if (pair.maker && pair.maker.toLowerCase() === maker.toLowerCase()) return pair;
  }
  return PAIRS.ETH;
}

/** Every launch on the factory so far used config 0, stock pairs included. */
export const LAUNCH_CONFIG_ID = 0;
