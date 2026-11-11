import { apiWorkspace } from "@/lib/auth";
import { markSent } from "@/lib/invoices";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  const { id } = await ctx.params;
  await markSent(ws.id, Number(id), "owner");
  return Response.json({ ok: true });
}
