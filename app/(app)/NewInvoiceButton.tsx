"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewInvoiceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn px-3 py-1.5 text-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/invoices", { method: "POST" });
        const { id } = await r.json();
        router.push(`/invoices/${id}`);
      }}
    >
      New invoice
    </button>
  );
}
