import { apiWorkspace } from "@/lib/auth";
import { recordPayment } from "@/lib/invoices";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const r = await recordPayment(ws.id, Number(id), { amount: Number(body.amount) || undefined, reference: body.reference || undefined }, "owner");
    return Response.json({ ok: true, full: r.full });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
