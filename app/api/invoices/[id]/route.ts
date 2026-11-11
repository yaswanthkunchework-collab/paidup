import { apiWorkspace } from "@/lib/auth";
import { deleteInvoice, updateInvoice } from "@/lib/invoices";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const r = await updateInvoice(ws.id, Number(id), await req.json(), "owner");
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  const { id } = await ctx.params;
  await deleteInvoice(ws.id, Number(id));
  return Response.json({ ok: true });
}
