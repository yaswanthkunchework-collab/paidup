"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientActions({ token, status }: { token: string; status: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "query" | "reported">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function send(action: "approve" | "query" | "reported") {
    setBusy(true);
    const r = await fetch(`/api/public/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, message: text }),
    });
    setBusy(false);
    if (r.ok) {
      setDone(
        action === "approve"
          ? "Approved. We've let them know."
          : action === "query"
            ? "Your question has been sent."
            : "Thanks. They'll confirm once it reaches their account.",
      );
      setMode(null);
      setText("");
      router.refresh();
    }
  }

  if (mode) {
    return (
      <div className="mt-4 space-y-2">
        <label className="block text-sm">
          {mode === "query" ? "What would you like to ask or change?" : "Payment reference (UPI / UTR), optional"}
          <textarea
            rows={mode === "query" ? 3 : 1}
            className="mt-1 w-full rounded-md border border-rule px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </label>
        <div className="flex gap-2">
          <button className="btn flex-1" disabled={busy || (mode === "query" && !text.trim())} onClick={() => send(mode)}>
            {mode === "query" ? "Send question" : "Confirm payment sent"}
          </button>
          <button className="btn btn-quiet" onClick={() => setMode(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {done && <p className="text-sm text-stamp">{done}</p>}
      {status !== "approved" && status !== "reported" && (
        <button className="btn w-full border-stamp bg-stamp" disabled={busy} onClick={() => send("approve")}>Approve invoice</button>
      )}
      {status !== "reported" && (
        <button className="btn btn-quiet w-full" onClick={() => setMode("reported")}>I've paid</button>
      )}
      <button className="btn btn-quiet w-full" onClick={() => setMode("query")}>Ask a question</button>
    </div>
  );
}
