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

/**
 * PaidUp's MCP server is stateless and never pushes messages on its own, so it declines the optional
 * long-lived GET listening stream (allowed by the MCP Streamable HTTP spec). Holding it open would only
 * hit Vercel's function time limit. All tool calls go over POST.
 */
function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST, DELETE" } });
}

export { GET, handle as POST, handle as DELETE };
