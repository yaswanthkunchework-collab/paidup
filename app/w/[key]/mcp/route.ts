import { getWorkspaceByKey } from "@/lib/invoices";
import { buildMcpHandler } from "@/lib/mcp";
import { baseUrl } from "@/lib/url";

export const runtime = "nodejs";
export const maxDuration = 30;

async function handle(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const ws = await getWorkspaceByKey(key);
  if (!ws) {
    return Response.json({ error: "Unknown PaidUp connector link. Copy it again from the Connect page." }, { status: 404 });
  }
  return buildMcpHandler(ws, baseUrl(req))(req);
}

export { handle as GET, handle as POST, handle as DELETE };
