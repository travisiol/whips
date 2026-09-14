"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/components/ConnectButton";
import { timeAgo } from "@/lib/format";

/**
 * "4m ago", rendered only once the client owns the tree — the server's clock
 * and the browser's never agree to the second, so relative times are not
 * part of the server HTML. Re-renders every 10 s so "12s ago" keeps moving.
 */
export function TimeAgo({ ts, prefix = "", fallback = "" }: { ts: number; prefix?: string; fallback?: string }) {
  const mounted = useMounted();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  if (!mounted) return <>{fallback}</>;
  return (
    <>
      {prefix}
      {timeAgo(ts)}
    </>
  );
}
