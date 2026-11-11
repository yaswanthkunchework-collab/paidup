"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copy", onCopied, className = "btn btn-quiet" }: { text: string; label?: string; onCopied?: () => void; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        onCopied?.();
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
