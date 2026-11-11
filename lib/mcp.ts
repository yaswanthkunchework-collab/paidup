import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  createInvoice,
  getInvoiceDetail,
  listInvoices,
  recordPayment,
  summary,
  updateInvoice,
  findInvoice,
  type InvoiceDetail,
  type InvoiceRow,
  type Workspace,
} from "./invoices";
import { inr, STATUS_LABEL, fmtDate } from "./money";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const itemSchema = z.object({
  description: z.string().min(1).describe("What was delivered, written clearly for the client, e.g. 'Landing page design — 1 page, 2 revision rounds'."),
  quantity: z.number().positive().default(1).describe("Units, hours, pages, etc. Defaults to 1."),
  rate: z.number().nonnegative().describe("Price per unit in INR, BEFORE GST."),
  gst_rate: z.number().min(0).max(28).default(18).describe("GST % for this line. Indian services are usually 18. Use 0 if the user says they are not GST-registered."),
});

const clientSchema = z.object({
  name: z.string().min(1).describe("Client business name. Reuses the saved client if it already exists."),
  email: z.string().optional().describe("Billing email, if known."),
  phone: z.string().optional(),
  gstin: z.string().optional().describe("Client GSTIN, if known."),
  state: z.string().optional().describe("Indian state of the client (e.g. 'Karnataka'). Decides CGST+SGST vs IGST. Leave empty if unknown."),
  address: z.string().optional(),
});

function statusText(r: InvoiceRow) {
  let s = STATUS_LABEL[r.status] ?? r.status;
  if (r.overdue) s += ` · OVERDUE ${r.days_overdue}d`;
  return s;
}

function line(r: InvoiceRow, base: string) {
  return [
    `• ${r.number} — ${r.client_name}`,
    `  total ${inr(r.total)}, balance ${inr(r.balance)}, due ${fmtDate(r.due_date)}, status: ${statusText(r)}`,
    `  views by client: ${r.view_count}${r.last_viewed_at ? ` (last ${new Date(r.last_viewed_at).toISOString().slice(0, 10)})` : ""}${r.client_email ? `, email: ${r.client_email}` : ""}`,
    `  client link: ${base}/i/${r.public_token} · id: ${r.id}`,
  ].join("\n");
}

function detailText(d: InvoiceDetail, ws: Workspace, base: string) {
  const t = d.totals;
  const tax = t.intraState
    ? `CGST ${inr(t.cgst)} + SGST ${inr(t.sgst)}`
    : `IGST ${inr(t.igst)}`;
  return [
    `${d.number} (id ${d.id}) — ${statusText(d)}`,
    `From: ${ws.business_name}${ws.state ? `, ${ws.state}` : ""}`,
    `To: ${d.client_name}${d.client_state ? `, ${d.client_state}` : ""}${d.client_gstin ? ` · GSTIN ${d.client_gstin}` : ""}${d.client_email ? ` · ${d.client_email}` : ""}`,
    `Issued ${fmtDate(d.issue_date)} · Due ${fmtDate(d.due_date)}`,
    ``,
    ...d.items.map((i) => `- ${i.description}: ${i.quantity} × ${inr(i.rate)} (+${i.gst_rate}% GST)`),
    ``,
    `Subtotal ${inr(t.subtotal)} · ${tax} · TOTAL ${inr(t.total)}`,
    `Paid ${inr(d.paid_amount)} · Balance ${inr(d.balance)}`,
    d.client_query ? `Client's query: "${d.client_query}"` : "",
    d.notes ? `Notes: ${d.notes}` : "",
    ``,
    `Client link (share this): ${base}/i/${d.public_token}`,
    `Edit in PaidUp: ${base}/invoices/${d.id}`,
    ``,
    `Activity (newest first):`,
    ...d.events.slice(0, 10).map((e) => `- ${new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC · ${e.actor}: ${e.detail ?? e.type}`),
  ]
    .filter((x) => x !== "")
    .join("\n");
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });

export function buildMcpHandler(ws: Workspace, base: string) {
  return createMcpHandler(
    (server) => {
      server.registerTool(
        "create_invoice",
        {
          title: "Create invoice",
          description:
            `Create a GST invoice in the user's PaidUp account (${ws.business_name}) and get a shareable client link. ` +
            "Use this when the user wants to bill or invoice a client. Read any email thread, chat, timesheet or notes the user gives you, " +
            "work out the billable line items, and write clear, professional descriptions. Give rates BEFORE GST: PaidUp calculates GST " +
            "(CGST+SGST or IGST), totals, invoice number and amount in words itself, so do not compute them yourself. " +
            "If a key detail is genuinely missing (client name, what was delivered, or price), ask the user before calling. " +
            "The invoice is always saved as a DRAFT and nothing is sent to the client. The user reviews it in the PaidUp dashboard and " +
            "emails it to the client from there (only the dashboard can send). After creating, tell the user the draft is saved and give " +
            "them the 'Edit in PaidUp' link to review and send it. Do not present the client link as something to share before it is sent.",
          inputSchema: z.object({
            client: clientSchema,
            items: z.array(itemSchema).min(1).describe("Billable line items."),
            issue_date: date.optional().describe("Defaults to today (IST)."),
            due_in_days: z.number().int().min(0).max(180).optional().describe("Payment terms in days. Default 15."),
            due_date: date.optional().describe("Exact due date; overrides due_in_days."),
            notes: z.string().optional().describe("Optional note shown on the invoice, e.g. payment instructions or a thank-you."),
          }),
          annotations: { destructiveHint: false, idempotentHint: false },
        },
        async (args) => {
          try {
            const id = await createInvoice(ws.id, { ...args, status: "draft" }, "claude");
            const d = await getInvoiceDetail(ws.id, id, ws.state);
            return text(`Draft invoice saved. Not sent yet: the user reviews it and emails it to the client from the PaidUp dashboard.\n\n${detailText(d!, ws, base)}`);
          } catch (e) {
            return fail(`Could not create invoice: ${(e as Error).message}`);
          }
        },
      );

      server.registerTool(
        "list_invoices",
        {
          title: "List invoices",
          description:
            "List the user's invoices with amounts, due dates, status (draft/sent/viewed/approved/query raised/payment reported/paid), " +
            "overdue days and how many times the client opened it. Use filter 'overdue' or 'unpaid' to find who owes money.",
          inputSchema: z.object({
            filter: z
              .enum(["all", "unpaid", "overdue", "draft", "sent", "viewed", "approved", "query", "reported", "paid"])
              .default("unpaid"),
            client: z.string().optional().describe("Optional part of a client name to filter by."),
            limit: z.number().int().min(1).max(100).default(25),
          }),
          annotations: { readOnlyHint: true },
        },
        async ({ filter, client, limit }) => {
          const rows = await listInvoices(ws.id, { filter, client, limit });
          if (!rows.length) return text(`No ${filter} invoices found.`);
          return text(`${rows.length} ${filter} invoice(s):\n\n${rows.map((r) => line(r, base)).join("\n\n")}`);
        },
      );

      server.registerTool(
        "get_invoice",
        {
          title: "Get invoice",
          description:
            "Get one invoice in full: line items, GST split, totals, payments, the client's query if any, the client link and the activity timeline " +
            "(created, edited, viewed by client, approved, paid). Accepts the invoice id, the full number (INV/26-27/0007) or just the sequence (7).",
          inputSchema: z.object({ invoice: z.string().describe("Invoice id, number, or sequence number.") }),
          annotations: { readOnlyHint: true },
        },
        async ({ invoice }) => {
          const d = await getInvoiceDetail(ws.id, invoice, ws.state);
          if (!d) return fail(`No invoice matching "${invoice}". Try list_invoices.`);
          return text(detailText(d, ws, base));
        },
      );

      server.registerTool(
        "update_invoice",
        {
          title: "Update invoice",
          description:
            "Change an existing invoice: client details, line items (send the FULL new list — it replaces the old one), dates or notes. " +
            "This cannot send the invoice or change its status; sending happens only from the PaidUp dashboard. " +
            "Use get_invoice first if you need the current line items. Changes show up live in PaidUp and on the client's link. " +
            "Invoices with a recorded payment (part or full) are locked and cannot be changed.",
          inputSchema: z.object({
            invoice: z.string().describe("Invoice id, number, or sequence number."),
            client: clientSchema.partial().optional().describe("Fields to change. Changing the name moves the invoice to that client."),
            items: z.array(itemSchema).min(1).optional().describe("Complete replacement list of line items."),
            issue_date: date.optional(),
            due_date: date.optional(),
            notes: z.string().optional(),
          }),
          annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ invoice, ...patch }) => {
          const inv = await findInvoice(ws.id, invoice);
          if (!inv) return fail(`No invoice matching "${invoice}".`);
          try {
            const { changes } = await updateInvoice(ws.id, inv.id, patch, "claude");
            const d = await getInvoiceDetail(ws.id, inv.id, ws.state);
            return text(`${changes.length ? "Saved changes." : "No changes."}\n\n${detailText(d!, ws, base)}`);
          } catch (e) {
            return fail(`Could not update: ${(e as Error).message}`);
          }
        },
      );

      server.registerTool(
        "mark_paid",
        {
          title: "Record payment",
          description:
            "Record a payment the user received against an invoice. Leave amount empty for full payment; give an amount for a part payment. " +
            "Optionally include the UPI/UTR reference and payment date.",
          inputSchema: z.object({
            invoice: z.string().describe("Invoice id, number, or sequence number."),
            amount: z.number().positive().optional().describe("Amount received in INR. Omit for the full balance."),
            paid_on: date.optional(),
            reference: z.string().optional().describe("UPI/UTR/cheque reference."),
          }),
          annotations: { destructiveHint: false, idempotentHint: false },
        },
        async ({ invoice, amount, paid_on, reference }) => {
          const inv = await findInvoice(ws.id, invoice);
          if (!inv) return fail(`No invoice matching "${invoice}".`);
          const r = await recordPayment(ws.id, inv.id, { amount, paid_on, reference }, "claude");
          if (r.already) return text(`${inv.number} was already marked paid.`);
          const d = await getInvoiceDetail(ws.id, inv.id, ws.state);
          return text(`Recorded ${inr(r.amount!)} against ${inv.number}.\n\n${detailText(d!, ws, base)}`);
        },
      );

      server.registerTool(
        "get_receivables_summary",
        {
          title: "Receivables summary",
          description:
            "Who owes the user money right now: total outstanding and overdue, aging buckets, amounts by client, and every overdue invoice with days late, " +
            "how often the client viewed it, whether they approved or raised a query, their email and the payment link. " +
            "Use this to answer 'who should I chase first?' and to draft personalised, polite follow-up messages (email or WhatsApp) — " +
            "firmer for long-overdue invoices the client has already viewed; gentle nudges for recent ones. Always include the client link in follow-ups.",
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        },
        async () => {
          const s = await summary(ws.id);
          const out = [
            `Receivables for ${ws.business_name} (as of today, IST)`,
            `Outstanding: ${inr(s.outstanding.amount)} across ${s.outstanding.count} invoice(s)`,
            `Overdue: ${inr(s.overdue.amount)} across ${s.overdue.count} invoice(s)`,
            `Collected in last 30 days: ${inr(s.paid_last_30_days.amount)}`,
            `Needs the user's attention (client query / payment reported): ${s.needs_attention}`,
            ``,
            `Aging of overdue amounts:`,
            ...Object.entries(s.aging).map(([k, v]) => `- ${k}: ${inr(v.amount)} (${v.count})`),
            ``,
            `By client (overdue first):`,
            ...s.by_client.map((c) => `- ${c.client}: outstanding ${inr(c.outstanding)}, overdue ${inr(c.overdue)} (${c.invoices} invoice(s))`),
            ``,
            `Open invoices:`,
            ...s.open_invoices.map((r) => line(r, base) + (r.approved_at ? `\n  client approved on ${new Date(r.approved_at).toISOString().slice(0, 10)}` : "") + (r.client_query ? `\n  client query: "${r.client_query}"` : "")),
          ];
          return text(out.join("\n"));
        },
      );
    },
    {
      serverInfo: { name: "PaidUp", version: "1.0.0" },
      instructions:
        `PaidUp is ${ws.business_name}'s invoicing and collections app (India, INR, GST, UPI). ` +
        "You do the reading and writing (working out line items, writing descriptions and follow-up messages); PaidUp stores invoices, " +
        "calculates GST and totals, hosts the client payment page with a UPI QR, and tracks views, approvals and payments. " +
        "Never invent totals — always report the totals PaidUp returns. " +
        "Invoices you create are drafts; only the user can send them to the client, by email from the PaidUp dashboard.",
    },
  );
}
