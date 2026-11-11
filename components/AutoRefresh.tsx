"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server data every few seconds so changes made from Claude or by the client appear live. */
export function AutoRefresh({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
