import { apiWorkspace } from "@/lib/auth";
import { getInvoiceDetail, markEmailed } from "@/lib/invoices";
import { emailConfigured, isValidEmail, sendInvoiceEmail } from "@/lib/email";
import { baseUrl } from "@/lib/url";

// Sending to the client happens only here, behind the owner's dashboard login.
// Claude's MCP connector has no tool that reaches this route.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  if (!emailConfigured()) {
    return Response.json({ error: "Email isn't set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel." }, { status: 503 });
  }
  const { id } = await ctx.params;
  const inv = await getInvoiceDetail(ws.id, Number(id), ws.state);
  if (!inv) return Response.json({ error: "Invoice not found." }, { status: 404 });
  if (inv.status === "paid") return Response.json({ error: "This invoice is already paid." }, { status: 400 });

  const to = inv.client_email?.trim();
  if (!isValidEmail(to)) return Response.json({ error: "Add a valid billing email for this client and save first." }, { status: 400 });

  const resend = inv.events.some((e) => e.type === "emailed");
  const link = `${baseUrl(req)}/i/${inv.public_token}`;
  try {
    await sendInvoiceEmail(ws, inv, to, link, resend);
  } catch (e) {
    console.error("Invoice email failed", e);
    const auth = /auth|credentials|535|534/i.test((e as Error).message);
    return Response.json(
      { error: auth ? "Gmail rejected the login. Check GMAIL_USER and the app password in Vercel." : "Couldn't send the email. Try again." },
      { status: 502 },
    );
  }
  await markEmailed(ws.id, inv.id, to, resend, "owner");
  return Response.json({ ok: true, to, resend });
}
