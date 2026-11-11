"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "reset" | "clear">(null);

  async function run(kind: "reset" | "clear") {
    const ok = confirm(
      kind === "reset"
        ? "Replace all invoices with the sample invoices?"
        : "Delete every invoice? This can't be undone.",
    );
    if (!ok) return;
    setBusy(kind);
    await fetch(kind === "reset" ? "/api/demo/reset" : "/api/demo/clear", { method: "POST" });
    setBusy(null);
    router.push("/dashboard");
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="btn btn-quiet" disabled={!!busy} onClick={() => run("reset")}>
        {busy === "reset" ? "Resetting…" : "Reset demo data"}
      </button>
      <button className="btn btn-quiet text-ledger hover:border-ledger" disabled={!!busy} onClick={() => run("clear")}>
        {busy === "clear" ? "Deleting…" : "Delete all invoices"}
      </button>
    </div>
  );
}
