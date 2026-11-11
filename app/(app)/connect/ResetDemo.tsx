"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-quiet mt-3"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Reset all demo invoices?")) return;
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        setBusy(false);
        router.push("/dashboard");
      }}
    >
      {busy ? "Resetting…" : "Reset demo data"}
    </button>
  );
}
