"use client";

import { useState } from "react";

/** Copies `value` to the clipboard and says so for a moment. */
export function CopyButton({ value, label = "copy", className = "" }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm !h-8 !px-3 !text-[12px] ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — the value is visible next to the button */
        }
      }}
    >
      {done ? "copied" : label}
    </button>
  );
}
