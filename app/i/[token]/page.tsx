import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import type { Metadata } from "next";
import { getPublicInvoice, recordView } from "@/lib/invoices";
import { sessionWorkspaceId } from "@/lib/auth";
import { amountInWords, fmtDate, inr, upiLink } from "@/lib/money";
import { StatusStamp } from "@/components/Status";
import { ClientActions } from "./ClientActions";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = { robots: { index: false } };

export default async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicInvoice(token);
  if (!data) notFound();
  const { ws, inv } = data;
  const isOwner = (await sessionWorkspaceId()) === ws.id;
  if (!isOwner) await recordView(inv.id);

  const t = inv.totals;
  const paid = inv.status === "paid";
  const qr =
    !paid && ws.upi_id && inv.balance > 0
      ? await QRCode.toDataURL(upiLink({ vpa: ws.upi_id, payee: ws.business_name, amount: inv.balance, note: inv.number }), {
          margin: 1,
          width: 360,
          color: { dark: "#1d2a44", light: "#ffffff" },
        })
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {isOwner && (
        <div className="no-print mb-4 rounded-md border border-dashed border-claude bg-white px-4 py-2 text-sm text-claude">
          This is what your client sees. Your own visits aren't counted as views.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="sheet relative rounded-lg p-6 sm:p-10">
          {paid && <div className="paid-stamp right-8 top-60 sm:right-14">PAID</div>}
          <header className="flex flex-wrap justify-between gap-6 border-b border-rule pb-6">
            <div>
              <div className="text-lg font-bold">{ws.business_name}</div>
              <div className="mt-1 max-w-xs text-sm text-muted">{ws.address}</div>
              {ws.gstin && <div className="num mt-1 text-sm text-muted">GSTIN {ws.gstin}</div>}
              <div className="mt-1 text-sm text-muted">{[ws.email, ws.phone].filter(Boolean).join(", ")}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-sm text-muted">Tax invoice</div>
              <div className="num text-xl font-semibold">{inv.number}</div>
              <div className="num mt-2 text-sm text-ink-soft">Issued {fmtDate(inv.issue_date)}</div>
              <div className={`num text-sm ${inv.overdue ? "font-semibold text-ledger" : "text-ink-soft"}`}>Due {fmtDate(inv.due_date)}</div>
            </div>
          </header>

          <section className="border-b border-rule py-5">
            <div className="text-sm text-muted">Bill to</div>
            <div className="mt-1 font-semibold">{inv.client_name}</div>
            <div className="text-sm text-ink-soft">{[inv.client_address, inv.client_state].filter(Boolean).join(", ")}</div>
            {inv.client_gstin && <div className="num text-sm text-ink-soft">GSTIN {inv.client_gstin}</div>}
          </section>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">Rate</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">GST</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it) => (
                <tr key={it.id} className="border-t border-rule align-top">
                  <td className="py-2.5 pr-3">{it.description}</td>
                  <td className="num py-2.5 pl-3 text-right">{it.quantity}</td>
                  <td className="num hidden py-2.5 text-right sm:table-cell">{inr(it.rate)}</td>
                  <td className="num hidden py-2.5 text-right sm:table-cell">{it.gst_rate}%</td>
                  <td className="num py-2.5 pl-4 text-right">{inr(it.quantity * it.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="mt-4 flex flex-wrap justify-between gap-6 border-t border-rule pt-5">
            <div className="max-w-sm text-sm text-ink-soft">{inv.notes}</div>
            <dl className="num ml-auto grid w-64 grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-right">{inr(t.subtotal)}</dd>
              {t.intraState ? (
                <>
                  <dt className="text-muted">CGST</dt>
                  <dd className="text-right">{inr(t.cgst)}</dd>
                  <dt className="text-muted">SGST</dt>
                  <dd className="text-right">{inr(t.sgst)}</dd>
                </>
              ) : (
                <>
                  <dt className="text-muted">IGST</dt>
                  <dd className="text-right">{inr(t.igst)}</dd>
                </>
              )}
              <dt className="border-t border-rule pt-1.5 font-semibold">Total</dt>
              <dd className="border-t border-rule pt-1.5 text-right font-semibold">{inr(t.total)}</dd>
              {inv.paid_amount > 0 && (
                <>
                  <dt className="text-muted">Paid</dt>
                  <dd className="text-right text-stamp">− {inr(inv.paid_amount)}</dd>
                </>
              )}
              <dt className="font-semibold">Balance due</dt>
              <dd className="text-right text-lg font-bold">{inr(inv.balance)}</dd>
            </dl>
            <p className="w-full text-right text-xs text-muted">{amountInWords(t.total)}</p>
          </section>
        </article>

        <aside className="no-print order-first space-y-4 lg:order-none lg:sticky lg:top-6 lg:self-start">
          <div className="sheet rounded-lg p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{paid ? "Paid in full" : "Amount due"}</span>
              <StatusStamp status={inv.status} overdueDays={inv.days_overdue} />
            </div>
            <div className={`num mt-1 text-3xl font-bold ${inv.overdue ? "text-ledger" : ""}`}>{inr(paid ? inv.total : inv.balance)}</div>
            {qr && (
              <div className="mt-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={`UPI QR code to pay ${inr(inv.balance)}`} className="mx-auto w-48" />
                <p className="mt-2 text-sm text-ink-soft">Scan with any UPI app</p>
                <p className="num text-sm font-medium">{ws.upi_id}</p>
              </div>
            )}
            {paid ? (
              <p className="mt-3 text-sm text-stamp">Thank you. This invoice is settled.</p>
            ) : (
              <ClientActions token={token} status={inv.status} />
            )}
          </div>
          <PrintButton />
          <p className="text-center text-xs text-muted">
            Sent with <Link href="/" className="font-semibold text-ink">PaidUp</Link>, invoicing from Claude
          </p>
        </aside>
      </div>
    </main>
  );
}
