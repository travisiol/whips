import * as fs from "node:fs";
import * as path from "node:path";
import type { NextConfig } from "next";

/**
 * wagmi's Base Account connector dynamically imports `@base-org/account`,
 * whose Node build reaches for optional `@x402/*` payment packages that are
 * not installed and never executed here. The bundler still tries to resolve
 * them, so they are aliased to an empty module. Turbopack is the default
 * bundler in Next 16; the webpack aliases only apply when `--webpack` is
 * passed (a webpack config would otherwise fail the Turbopack build).
 */
const OPTIONAL_MODULES = [
  "@x402/core",
  "@x402/core/client",
  "@x402/core/server",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/exact/server",
  "@x402/evm/upto/client",
  "@x402/evm/upto/server",
  "@x402/svm",
  "@x402/svm/exact/client",
  "@x402/svm/exact/server",
  "@x402/extensions/bazaar",
  "@x402/express",
  "@x402/fetch",
];

/**
 * The launcher address comes from NEXT_PUBLIC_WHIPS_LAUNCHER, or — when that
 * is unset — from the record `contracts/scripts/deploy.ts` writes, so
 * `deploy:robinhood` followed by `next build` is the whole hand-off.
 */
function deployedLauncher(): string | undefined {
  if (process.env.NEXT_PUBLIC_WHIPS_LAUNCHER?.trim()) return undefined;
  const chainId = Number(process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_ID ?? 4663);
  const file = path.join(process.cwd(), "contracts", "deployments", "robinhood.json");
  try {
    const record = JSON.parse(fs.readFileSync(file, "utf8")) as { chainId?: number; launcher?: string; deployBlock?: number };
    if (Number(record.chainId) === chainId && typeof record.launcher === "string" && /^0x[0-9a-fA-F]{40}$/.test(record.launcher)) {
      return record.launcher;
    }
  } catch {
    /* no deployment record yet */
  }
  return undefined;
}

const launcher = deployedLauncher();
const useWebpack = process.argv.includes("--webpack");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: launcher ? { NEXT_PUBLIC_WHIPS_LAUNCHER: launcher } : {},
  turbopack: {
    resolveAlias: Object.fromEntries(OPTIONAL_MODULES.map((name) => [name, "./src/lib/empty.ts"])),
  },
  ...(useWebpack
    ? {
        webpack: (config) => {
          config.externals.push("pino-pretty", "lokijs", "encoding");
          config.resolve.alias = {
            ...config.resolve.alias,
            ...Object.fromEntries(OPTIONAL_MODULES.map((name) => [name, false])),
          };
          return config;
        },
      }
    : {}),
};

export default nextConfig;
