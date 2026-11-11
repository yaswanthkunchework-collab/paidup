# PaidUp

**Bill clients from a chat. Get paid from a link.**

PaidUp is invoicing and collections for Indian freelancers and small agencies, run from your own Claude.
You ask Claude to bill a client. Claude reads the thread, works out the line items and calls PaidUp over MCP.
PaidUp turns that into a GST invoice with a client link where the client can approve it, ask a question, or pay by UPI,
and it keeps a live ledger of who owes you what.

**There is no AI inside PaidUp.** No OpenAI, Anthropic or other AI keys or SDKs. The customer's own Claude does the
reading and writing; PaidUp does the record-keeping: numbering, GST maths, hosting, view tracking, approvals and payments.

## Try it

| | |
|---|---|
| Live app | `https://<your-deployment>.vercel.app` |
| Demo login | `demo@paidup.app` / `paidup-demo` |
| MCP link | Shown on the **Connect Claude** page after logging in (`/w/<key>/mcp`) |

### Connect to Claude

1. Log in and open **Connect Claude**. Copy the connector link.
2. In Claude, go to **Customize → Connectors** (or **Settings → Connectors**) → **Add custom connector**. Name it `PaidUp`, paste the link, add. No sign-in needed.
3. In a new chat, switch PaidUp on in the connectors menu and try:
   - "Invoice Acme Media for 3 blog posts at ₹6,000 each, they're in Bengaluru. Due in 15 days."
   - "Who owes me money? Rank who to chase first and draft a WhatsApp follow-up for each."
   - "Orbit Analytics paid ₹50,000 today, ref 4471 2290. Record it."

Watch the dashboard: invoices made from Claude appear within a few seconds, tagged **Claude**.

## MCP tools

| Tool | What it does |
|---|---|
| `create_invoice` | Client + line items in → numbered GST invoice saved as a **draft** (Claude never sends it) |
| `list_invoices` | Filter by unpaid / overdue / status / client |
| `get_invoice` | Full invoice, GST split, payments, client query and activity timeline |
| `update_invoice` | Change client details, line items, dates, notes (can't send or change status) |
| `mark_paid` | Record a full or part payment with UPI/UTR reference |
| `get_receivables_summary` | Outstanding, overdue, aging buckets, by client: powers "who should I chase first?" |

## Sending invoices

Invoices made from Claude are saved as drafts. You review them in the dashboard and click **Email to client**, which
emails the client link to the client's billing email from your Gmail. Only the dashboard can send; Claude's connector
has no tool for it. Until a draft is sent, its client link shows "This invoice isn't ready yet" to anyone but you.

Setup: in Vercel → Project → Settings → Environment Variables, add `GMAIL_USER` (your Gmail address) and
`GMAIL_APP_PASSWORD` (a [Google app password](https://myaccount.google.com/apppasswords); needs 2-Step Verification), then redeploy.

## What the app does (plain code)

- Invoice numbers per Indian financial year (`INV/26-27/0007`)
- GST: CGST + SGST when seller and client are in the same state, IGST otherwise; amount in words (lakh/crore)
- Client page with UPI QR for the exact balance, **Approve**, **Ask a question**, **I've paid**, print to PDF
- View tracking, approvals, queries and payments in an activity timeline (Claude / You / Client)
- Dashboard: outstanding, overdue, collected in 30 days, items waiting on you; live refresh
- Edit anything on the invoice in place; totals recalculate as you type

## Stack

Next.js (App Router) on Vercel · Postgres (Neon) via `postgres` · MCP over Streamable HTTP via `mcp-handler` · `qrcode`.

## Run locally

```bash
npm install
DATABASE_URL=postgres://... npm run dev
```

Tables and the demo workspace are created automatically on first request. Test the MCP server with
`node scripts/test-mcp.mjs http://localhost:3000/w/<key>/mcp`.
