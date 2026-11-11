import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireWorkspace } from "@/lib/auth";
import { getInvoiceDetail } from "@/lib/invoices";
import { baseUrl } from "@/lib/url";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Editor } from "./Editor";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await requireWorkspace();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const inv = await getInvoiceDetail(ws.id, Number(id), ws.state);
  if (!inv || inv.id !== Number(id)) notFound();
  const link = `${baseUrl({ headers: await headers() })}/i/${inv.public_token}`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <AutoRefresh every={3000} />
      <Editor
        ws={{ business_name: ws.business_name, address: ws.address, gstin: ws.gstin, state: ws.state, email: ws.email, phone: ws.phone }}
        inv={{
          id: inv.id,
          number: inv.number,
          status: inv.status,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          notes: inv.notes ?? "",
          client: {
            name: inv.client_name,
            email: inv.client_email ?? "",
            state: inv.client_state ?? "",
            gstin: inv.client_gstin ?? "",
            address: inv.client_address ?? "",
          },
          items: inv.items.map(({ description, quantity, rate, gst_rate }) => ({ description, quantity, rate, gst_rate })),
          paid_amount: inv.paid_amount,
          balance: inv.balance,
          total: inv.total,
          overdue_days: inv.days_overdue,
          view_count: inv.view_count,
          client_query: inv.client_query,
          payment_ref: inv.payment_ref,
          created_by: inv.created_by,
          version: new Date(inv.updated_at).getTime(),
        }}
        events={inv.events.map((e) => ({ ...e, created_at: new Date(e.created_at).toISOString() }))}
        link={link}
      />
    </main>
  );
}
