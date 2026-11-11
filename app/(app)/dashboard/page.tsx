import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { listInvoices, summary, type ListFilter } from "@/lib/invoices";
import { fmtDate, inr } from "@/lib/money";
import { ActorTag, StatusStamp } from "@/components/Status";
import { AutoRefresh } from "@/components/AutoRefresh";

const TABS: { key: ListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "draft", label: "Drafts" },
  { key: "paid", label: "Paid" },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ws = await requireWorkspace();
  const f = ((await searchParams).f ?? "all") as ListFilter;
  const [s, rows] = await Promise.all([summary(ws.id), listInvoices(ws.id, { filter: f })]);

  const figures = [
    { label: "Outstanding", value: inr(s.outstanding.amount, { decimals: false }), note: `${s.outstanding.count} open invoices`, cls: "text-ink" },
    { label: "Overdue", value: inr(s.overdue.amount, { decimals: false }), note: `${s.overdue.count} past due date`, cls: s.overdue.count ? "text-ledger" : "text-ink" },
    { label: "Collected, last 30 days", value: inr(s.paid_last_30_days.amount, { decimals: false }), note: `${s.paid_last_30_days.count} payments`, cls: "text-stamp" },
    { label: "Waiting on you", value: String(s.needs_attention), note: "client queries and reported payments", cls: s.needs_attention ? "text-amber" : "text-ink" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <AutoRefresh />
      <h1 className="text-2xl font-bold tracking-tight">Receivables</h1>
      <p className="mt-1 text-sm text-muted">Invoices created from Claude appear here. Click any invoice to edit it.</p>

      <section className="sheet mt-6 grid grid-cols-2 rounded-lg md:grid-cols-4">
        {figures.map((x, i) => (
          <div key={x.label} className={`px-5 py-4 ${i > 0 ? "md:border-l" : ""} ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} border-rule`}>
            <div className="text-sm text-muted">{x.label}</div>
            <div className={`num mt-1 text-2xl font-semibold ${x.cls}`}>{x.value}</div>
            <div className="mt-0.5 text-xs text-muted">{x.note}</div>
          </div>
        ))}
      </section>

      <nav className="mt-8 flex gap-1 border-b border-rule text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/dashboard" : `/dashboard?f=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 ${f === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-ink-soft hover:border-rule hover:text-action"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted">
          Nothing here yet. Ask Claude to “invoice a client”, or <Link href="/connect" className="link">connect Claude</Link> first.
        </div>
      ) : (
        <div className="sheet mt-4 overflow-x-auto rounded-lg">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-muted">
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-desk/60">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${r.id}`} className="num link">{r.number}</Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <ActorTag actor={r.created_by} /> {fmtDate(r.issue_date)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.client_name}</td>
                  <td className="num px-4 py-3">{fmtDate(r.due_date)}</td>
                  <td className="num px-4 py-3 text-right">{inr(r.total)}</td>
                  <td className={`num px-4 py-3 text-right font-medium ${r.overdue ? "text-ledger" : ""}`}>{r.balance ? inr(r.balance) : "—"}</td>
                  <td className="px-4 py-3"><StatusStamp status={r.status} overdueDays={r.days_overdue} /></td>
                  <td className="num px-4 py-3 text-right text-muted">{r.view_count || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
