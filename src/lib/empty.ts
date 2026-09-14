/**
 * Stand-in for the optional `@x402/*` payment packages that
 * @coinbase/cdp-sdk (pulled in by wagmi's Base Account connector) imports
 * but this app never executes. Turbopack resolves named imports
 * statically, so the names it looks for are exported here as inert stubs.
 */
const inert = () => {
  throw new Error("@x402 is not installed in whips");
};

export const ExactEvmScheme = inert;
export const ExactSvmScheme = inert;
export const UptoEvmScheme = inert;
export const HTTPFacilitatorClient = inert;
export const bazaarResourceServerExtension = inert;
export const paymentMiddlewareFromConfig = inert;
export const paymentMiddlewareFromHTTPServer = inert;
export const registerExactEvmScheme = inert;
export const toClientEvmSigner = inert;
export const wrapFetchWithPayment = inert;
export const x402Client = inert;
export const x402ResourceServer = inert;
export const x402HTTPResourceServer = inert;
const empty = {};
export default empty;
