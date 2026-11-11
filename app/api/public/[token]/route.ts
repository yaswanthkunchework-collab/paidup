import { clientAction } from "@/lib/invoices";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (!["approve", "query", "reported"].includes(action)) return Response.json({ error: "Unknown action." }, { status: 400 });
  try {
    await clientAction(token, action, body.message);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 404 });
  }
}
