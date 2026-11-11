"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { amountInWords, computeTotals, inr, type LineItem } from "@/lib/money";
import { ActorTag, StatusStamp } from "@/components/Status";
import { CopyButton } from "@/components/CopyButton";

type Client = { name: string; email: string; state: string; gstin: string; address: string };
type Inv = {
  id: number;
  number: string;
  status: string;
  issue_date: string;
  due_date: string;
  notes: string;
  client: Client;
  items: LineItem[];
  paid_amount: number;
  balance: number;
  total: number;
  overdue_days: number;
  view_count: number;
  client_query: string | null;
  payment_ref: string | null;
  created_by: string;
  version: number;
};
type Ev = { id: number; actor: string; type: string; detail: string | null; created_at: string };
type Ws = { business_name: string; address: string | null; gstin: string | null; state: string | null; email: string | null; phone: string | null };

type Draft = Pick<Inv, "issue_date" | "due_date" | "notes" | "client" | "items">;
const toDraft = (i: Inv): Draft => ({
  issue_date: i.issue_date,
  due_date: i.due_date,
  notes: i.notes,
  client: { ...i.client },
  items: i.items.map((x) => ({ ...x })),
});

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function Editor({ ws, inv, events, link }: { ws: Ws; inv: Inv; events: Ev[]; link: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => toDraft(inv));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState("");
  const [payRef, setPayRef] = useState("");
  const seen = useRef(inv.version);
  const [changedElsewhere, setChangedElsewhere] = useState(false);

  // Pick up edits made from Claude (or another tab) when there are no unsaved local edits.
  useEffect(() => {
    if (inv.version === seen.current) return;
    seen.current = inv.version;
    if (dirty) setChangedElsewhere(true);
    else setD(toDraft(inv));
  }, [inv, dirty]);

  const totals = useMemo(() => computeTotals(d.items, ws.state, d.client.state), [d.items, ws.state, d.client.state]);
  const balance = Math.max(0, totals.total - inv.paid_amount);

  const edit = (fn: (x: Draft) => void) => {
    setD((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(d),
    });
    setSaving(false);
    if (!r.ok) {
      setMsg((await r.json()).error ?? "Couldn't save. Try again.");
      return;
    }
    setDirty(false);
    setChangedElsewhere(false);
    setMsg("Saved");
    setTimeout(() => setMsg(null), 1500);
    router.refresh();
  }

  async function recordPay() {
    const r = await fetch(`/api/invoices/${inv.id}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmt) || undefined, reference: payRef || undefined }),
    });
    if (r.ok) {
      setPayOpen(false);
      setPayAmt("");
      setPayRef("");
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm(`Delete ${inv.number}? This can't be undone.`)) return;
    await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  const paid = inv.status === "paid";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* The invoice sheet, editable in place */}
      <article className="sheet relative rounded-lg p-6 sm:p-10">
        {paid && <div className="paid-stamp right-10 top-60">PAID</div>}
        <header className="flex flex-wrap justify-between gap-6 border-b border-rule pb-6">
          <div>
            <div className="text-lg font-bold">{ws.business_name}</div>
            <div className="mt-1 max-w-xs text-sm text-muted">{ws.address}</div>
            {ws.gstin && <div className="num mt-1 text-sm text-muted">GSTIN {ws.gstin}</div>}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted">Tax invoice</div>
            <div className="num text-xl font-semibold">{inv.number}</div>
            <div className="mt-2 grid grid-cols-[auto_150px] items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-muted">Issued</span>
              <input type="date" className="field num text-right" value={d.issue_date} onChange={(e) => edit((x) => void (x.issue_date = e.target.value))} />
              <span className="text-muted">Due</span>
              <input type="date" className="field num text-right" value={d.due_date} onChange={(e) => edit((x) => void (x.due_date = e.target.value))} />
            </div>
          </div>
        </header>

        <section className="grid gap-x-6 gap-y-1 border-b border-rule py-5 sm:grid-cols-2">
          <div className="text-sm text-muted sm:col-span-2">Bill to</div>
          <input aria-label="Client name" className="field text-base font-semibold" value={d.client.name} onChange={(e) => edit((x) => void (x.client.name = e.target.value))} />
          <input aria-label="Client email" placeholder="Billing email" className="field text-sm" value={d.client.email} onChange={(e) => edit((x) => void (x.client.email = e.target.value))} />
          <input aria-label="Client state" placeholder="State (decides CGST/SGST vs IGST)" className="field text-sm" value={d.client.state} onChange={(e) => edit((x) => void (x.client.state = e.target.value))} />
          <input aria-label="Client GSTIN" placeholder="Client GSTIN" className="field num text-sm" value={d.client.gstin} onChange={(e) => edit((x) => void (x.client.gstin = e.target.value))} />
        </section>

        <section className="py-5">
          <div className="hidden grid-cols-[1fr_70px_110px_70px_120px_28px] gap-2 px-1 pb-2 text-sm text-muted sm:grid">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">GST %</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {d.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_110px_70px_120px_28px] items-start gap-2 border-t border-rule py-1.5 first:border-t-0">
              <textarea
                aria-label="Description"
                rows={1}
                className="field resize-none"
                value={it.description}
                onChange={(e) => edit((x) => void (x.items[i].description = e.target.value))}
              />
              <input aria-label="Quantity" type="number" min="0" step="any" className="field num text-right" value={it.quantity} onChange={(e) => edit((x) => void (x.items[i].quantity = Number(e.target.value)))} />
              <input aria-label="Rate" type="number" min="0" step="any" className="field num text-right" value={it.rate} onChange={(e) => edit((x) => void (x.items[i].rate = Number(e.target.value)))} />
              <input aria-label="GST percent" type="number" min="0" max="28" step="any" className="field num text-right" value={it.gst_rate} onChange={(e) => edit((x) => void (x.items[i].gst_rate = Number(e.target.value)))} />
              <div className="num px-1 py-1.5 text-right">{inr(it.quantity * it.rate)}</div>
              <button
                aria-label="Remove line"
                className="py-1.5 text-muted hover:text-ledger"
                onClick={() => edit((x) => void x.items.splice(i, 1))}
                disabled={d.items.length === 1}
              >
                ×
              </button>
            </div>
          ))}
          <button className="mt-2 text-sm font-medium text-ink-soft hover:text-ink" onClick={() => edit((x) => void x.items.push({ description: "", quantity: 1, rate: 0, gst_rate: 18 }))}>
            + Add line
          </button>
        </section>

        <section className="flex flex-wrap justify-between gap-6 border-t border-rule pt-5">
          <label className="min-w-60 flex-1">
            <span className="text-sm text-muted">Notes for your client</span>
            <textarea rows={3} className="field mt-1 border-rule text-sm" value={d.notes} onChange={(e) => edit((x) => void (x.notes = e.target.value))} />
          </label>
          <dl className="num ml-auto grid w-72 grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right">{inr(totals.subtotal)}</dd>
            {totals.intraState ? (
              <>
                <dt className="text-muted">CGST</dt>
                <dd className="text-right">{inr(totals.cgst)}</dd>
                <dt className="text-muted">SGST</dt>
                <dd className="text-right">{inr(totals.sgst)}</dd>
              </>
            ) : (
              <>
                <dt className="text-muted">IGST</dt>
                <dd className="text-right">{inr(totals.igst)}</dd>
              </>
            )}
            <dt className="border-t border-rule pt-1.5 font-semibold">Total</dt>
            <dd className="border-t border-rule pt-1.5 text-right font-semibold">{inr(totals.total)}</dd>
            {inv.paid_amount > 0 && (
              <>
                <dt className="text-muted">Paid</dt>
                <dd className="text-right text-stamp">− {inr(inv.paid_amount)}</dd>
              </>
            )}
            <dt className="font-semibold">Balance due</dt>
            <dd className={`text-right text-lg font-bold ${inv.overdue_days ? "text-ledger" : ""}`}>{inr(balance)}</dd>
          </dl>
          <p className="w-full text-right text-xs text-muted">{amountInWords(totals.total)}</p>
        </section>
      </article>

      {/* Status rail */}
      <aside className="no-print space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div className="sheet space-y-4 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <StatusStamp status={inv.status} overdueDays={inv.overdue_days} />
            <span className="text-xs text-muted">{inv.view_count ? `Opened ${inv.view_count}×` : "Not opened yet"}</span>
          </div>
          {inv.client_query && inv.status === "query" && (
            <div className="rounded-md bg-amber-wash p-3 text-sm">
              <div className="font-semibold text-amber">Your client asked</div>
              <p className="mt-1">“{inv.client_query}”</p>
            </div>
          )}
          {inv.status === "reported" && (
            <div className="rounded-md bg-amber-wash p-3 text-sm">
              <div className="font-semibold text-amber">Client says they paid</div>
              {inv.payment_ref && <p className="num mt-1">Ref: {inv.payment_ref}</p>}
              <p className="mt-1 text-muted">Check your bank, then record the payment.</p>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={save} disabled={!dirty || saving}>
              {saving ? "Saving…" : dirty ? "Save changes" : msg === "Saved" ? "Saved" : "No changes"}
            </button>
            {dirty && (
              <button className="btn btn-quiet" onClick={() => { setD(toDraft(inv)); setDirty(false); setChangedElsewhere(false); }}>
                Discard
              </button>
            )}
          </div>
          {msg && msg !== "Saved" && <p className="text-sm text-ledger">{msg}</p>}
          {changedElsewhere && <p className="text-sm text-amber">This invoice was just changed from Claude or by your client. Save to keep your version, or discard to see the latest.</p>}

          <div className="border-t border-rule pt-4">
            <div className="text-sm text-muted">Client link</div>
            <div className="num mt-1 truncate text-sm">{link.replace(/^https?:\/\//, "")}</div>
            <div className="mt-2 flex gap-2">
              <CopyButton
                text={link}
                label="Copy link"
                className="btn btn-quiet flex-1"
                onCopied={() => inv.status === "draft" && fetch(`/api/invoices/${inv.id}/sent`, { method: "POST" }).then(() => router.refresh())}
              />
              <a className="btn btn-quiet flex-1" href={link} target="_blank" rel="noreferrer">Client view</a>
            </div>
          </div>

          {!paid && (
            <div className="border-t border-rule pt-4">
              {payOpen ? (
                <div className="space-y-2">
                  <input className="w-full rounded-md border border-rule px-3 py-2 text-sm num" placeholder={`Amount (default ${inr(balance)})`} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="decimal" />
                  <input className="w-full rounded-md border border-rule px-3 py-2 text-sm" placeholder="UPI / UTR reference (optional)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn flex-1 border-stamp bg-stamp" onClick={recordPay}>Record payment</button>
                    <button className="btn btn-quiet" onClick={() => setPayOpen(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-quiet w-full" onClick={() => setPayOpen(true)}>Record a payment</button>
              )}
            </div>
          )}
        </div>

        <div className="sheet rounded-lg p-5">
          <h2 className="text-sm font-semibold">Activity</h2>
          <ol className="mt-3 space-y-3">
            {events.map((e) => (
              <li key={e.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <ActorTag actor={e.actor} />
                  <span className="text-xs text-muted">{when(e.created_at)}</span>
                </div>
                <p className="mt-0.5 text-ink-soft">{e.detail ?? e.type}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex justify-between text-sm">
          <Link href="/dashboard" className="text-muted hover:text-ink">Back to invoices</Link>
          <button onClick={remove} className="text-muted hover:text-ledger">Delete invoice</button>
        </div>
      </aside>
    </div>
  );
}
