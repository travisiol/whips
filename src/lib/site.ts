/**
 * The one place the name lives. Everything user-facing reads from here, so
 * a rename is a change to this file and nothing else.
 */
export const site = {
  name: "whips",
  slug: "whips",
  tagline: "launch tokens. paired with cars.",
  description:
    "pick a legend. launch its token on robinhood chain in one transaction. the car becomes the token's identity.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://whips.example",
  x: process.env.NEXT_PUBLIC_X_URL ?? "",
  /** Shown in the footer on every page. */
  disclaimer: "cars are references, not partners. not affiliated with any maker.",
  /** The over-title above the hero. */
  builtOn: "built on robinhood chain · pons v2 · eth + tsla · f · rivn",
} as const;

export const CTA = {
  primary: "start your engine",
  secondary: "explore the garage",
} as const;
