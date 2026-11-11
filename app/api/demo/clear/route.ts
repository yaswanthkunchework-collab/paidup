import { apiWorkspace } from "@/lib/auth";
import { deleteAllInvoices } from "@/lib/invoices";

export async function POST() {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  const deleted = await deleteAllInvoices(ws.id);
  return Response.json({ ok: true, deleted });
}
