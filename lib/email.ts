import nodemailer, { type Transporter } from "nodemailer";
import type { InvoiceDetail, Workspace } from "./invoices";
import { fmtDate, inr } from "./money";

/**
 * Invoice emails go out through the owner's Gmail account (SMTP + Gmail app password).
 * Set GMAIL_USER and GMAIL_APP_PASSWORD in the environment. The From address is always
 * GMAIL_USER; the sender name shown to the client is the business name.
 */

export { EMAIL_RE, isValidEmail } from "./email-format";

export function emailConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transport: Transporter | undefined;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
    });
  }
  return transport;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function invoiceEmail(ws: Workspace, inv: InvoiceDetail, link: string, resend: boolean) {
  const amount = inr(inv.balance > 0 ? inv.balance : inv.totals.total);
  const due = fmtDate(inv.due_date);
  const subject = `Invoice ${inv.number} from ${ws.business_name}`;
  const intro = resend
    ? `Here is the latest version of invoice ${inv.number} for ${amount}, due on ${due}.`
    : `Please find invoice ${inv.number} for ${amount}, due on ${due}.`;
  const contact = [ws.owner_name, ws.business_name].filter(Boolean).join(", ");

  const text = [
    `Hi ${inv.client_name},`,
    ``,
    intro,
    ``,
    `View and pay: ${link}`,
    ``,
    `From that page you can approve the invoice, ask a question, pay by UPI, or download a PDF.`,
    ``,
    `Thanks,`,
    contact,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#1d2a44">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d6;border-radius:8px">
    <tr><td style="padding:28px">
      <p style="margin:0 0 16px">Hi ${esc(inv.client_name)},</p>
      <p style="margin:0 0 20px">${esc(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;border-top:1px solid #e4e0d6;border-bottom:1px solid #e4e0d6">
        <tr><td style="padding:10px 0;color:#6b7280">Invoice</td><td style="padding:10px 0;text-align:right">${esc(inv.number)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280">Amount due</td><td style="padding:10px 0;text-align:right;font-weight:bold">${esc(amount)}</td></tr>
        <tr><td style="padding:10px 0;color:#6b7280">Due date</td><td style="padding:10px 0;text-align:right">${esc(due)}</td></tr>
      </table>
      <p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#1d2a44;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">View &amp; pay invoice</a></p>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563">From that page you can approve the invoice, ask a question, pay by UPI, or download a PDF.</p>
      <p style="margin:0">Thanks,<br>${esc(contact)}</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export async function sendInvoiceEmail(ws: Workspace, inv: InvoiceDetail, to: string, link: string, resend: boolean) {
  const from = process.env.GMAIL_USER!;
  const { subject, text, html } = invoiceEmail(ws, inv, link, resend);
  await getTransport().sendMail({
    from: { name: ws.business_name, address: from },
    replyTo: from,
    to: to.trim(),
    subject,
    text,
    html,
  });
}
