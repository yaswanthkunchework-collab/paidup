import { apiWorkspace } from "@/lib/auth";
import { createInvoice } from "@/lib/invoices";

export async function POST() {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  const id = await createInvoice(
    ws.id,
    { client: { name: "New client" }, items: [{ description: "Describe the work", quantity: 1, rate: 0, gst_rate: 18 }], status: "draft" },
    "owner",
  );
  return Response.json({ id });
}
