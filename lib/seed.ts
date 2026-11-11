import crypto from "node:crypto";
import { sql } from "./db";

export const DEMO = {
  username: process.env.DEMO_USERNAME || "demo@paidup.app",
  password: process.env.DEMO_PASSWORD || "paidup-demo",
  business_name: process.env.DEMO_BUSINESS_NAME || "RightPrompt tech",
  owner_name: process.env.DEMO_OWNER_NAME || null,
  email: null as string | null,
  phone: "+91 98200 00000",
  address: "402, Sea Breeze Apartments, Bandra West, Mumbai 400050",
  state: "Maharashtra",
  gstin: "27ABCPR1234F1Z5",
  upi_id: process.env.DEMO_UPI_ID || "rightprompt.demo@upi",
};

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function shift(n: number) {
  const d = new Date(todayIST() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ago(days: number, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000);
}
function fy(date: string) {
  const [y, m] = date.split("-").map(Number);
  const s = m >= 4 ? y : y - 1;
  return `${String(s).slice(2)}-${String(s + 1).slice(2)}`;
}

export async function ensureDemoWorkspace() {
  const s = sql();
  const [existing] = await s`select id from workspaces order by id limit 1`;
  if (existing) {
    // One-time rename of the original demo persona to the demo customer, RightPrompt tech.
    await s`update workspaces set business_name = ${DEMO.business_name}, owner_name = ${DEMO.owner_name},
      email = ${DEMO.email}, upi_id = case when upi_id = 'ananyarao.demo@upi' then ${DEMO.upi_id} else upi_id end
      where business_name = 'Ananya Rao Design Studio'`;
    return;
  }
  const key = process.env.MCP_KEY || "pu_" + crypto.randomBytes(12).toString("hex");
  const [ws] = await s<{ id: number }[]>`
    insert into workspaces (business_name, owner_name, email, phone, address, state, gstin, upi_id, login_username, login_password, mcp_key)
    values (${DEMO.business_name}, ${DEMO.owner_name}, ${DEMO.email}, ${DEMO.phone}, ${DEMO.address}, ${DEMO.state},
      ${DEMO.gstin}, ${DEMO.upi_id}, ${DEMO.username}, ${DEMO.password}, ${key})
    on conflict do nothing
    returning id`;
  if (ws) await seedDemoData(ws.id);
}

const CLIENTS = [
  { name: "Northwind Foods Pvt Ltd", email: "accounts@northwindfoods.example", state: "Maharashtra", gstin: "27AAACN1111A1Z2", address: "Baner, Pune 411045" },
  { name: "Orbit Analytics", email: "finance@orbitanalytics.example", state: "Karnataka", gstin: "29AABCO2222B1Z8", address: "HSR Layout, Bengaluru 560102" },
  { name: "Lotus Wellness LLP", email: "priya@lotuswellness.example", state: "Telangana", gstin: "36AAFFL3333C1Z1", address: "Jubilee Hills, Hyderabad 500033" },
  { name: "Saffron Stays", email: "ops@saffronstays.example", state: "Goa", gstin: null, address: "Assagao, North Goa 403507" },
  { name: "Kite Learning", email: "rahul@kitelearning.example", state: "Maharashtra", gstin: "27AAGCK4444D1Z6", address: "Andheri East, Mumbai 400069" },
];

type SeedInvoice = {
  client: number;
  issued: number; // days from today (negative = past)
  due: number;
  status: string;
  items: [string, number, number][]; // description, qty, rate
  views?: { first: number; last: number; count: number };
  approvedAgo?: number;
  paid?: { ago: number; ref: string };
  query?: string;
  notes?: string;
  events: [string, string, string, number][]; // actor, type, detail, daysAgo
};

const INVOICES: SeedInvoice[] = [
  {
    client: 0, issued: -62, due: -47, status: "paid",
    items: [["Brand identity — logo, colour palette, typography", 1, 45000], ["Packaging design — 3 SKUs", 3, 8000]],
    views: { first: 61, last: 50, count: 3 }, paid: { ago: 49, ref: "UTR 4312 8890 2211" },
    events: [["claude", "created", "Created from Claude", 62], ["client", "viewed", "Client opened the invoice", 61], ["owner", "paid", "₹81,420.00 received — fully paid", 49]],
  },
  {
    client: 1, issued: -53, due: -38, status: "viewed",
    items: [["Product dashboard UI redesign — 14 screens", 14, 3500], ["Design system starter kit", 1, 18000]],
    views: { first: 50, last: 6, count: 4 },
    notes: "Payment via UPI or bank transfer. Thank you for the work!",
    events: [["claude", "created", "Created from Claude", 53], ["client", "viewed", "Client opened the invoice", 50], ["client", "viewed", "Client opened the invoice", 21], ["client", "viewed", "Client opened the invoice", 6]],
  },
  {
    client: 4, issued: -27, due: -12, status: "sent",
    items: [["Course landing page design", 1, 22000], ["Social media creatives (set of 12)", 12, 1200]],
    events: [["claude", "created", "Created from Claude", 27]],
  },
  {
    client: 3, issued: -12, due: 3, status: "approved",
    items: [["Website refresh — 5 pages", 5, 6000], ["Photo retouching (40 images)", 40, 150]],
    views: { first: 10, last: 2, count: 2 }, approvedAgo: 2,
    events: [["claude", "created", "Created from Claude", 12], ["client", "viewed", "Client opened the invoice", 10], ["client", "approved", "Approved — will release payment on Friday", 2]],
  },
  {
    client: 2, issued: -5, due: 10, status: "viewed",
    items: [["Instagram campaign creatives — Diwali", 8, 2500], ["Copy for campaign posts", 8, 800]],
    views: { first: 3, last: 3, count: 1 },
    events: [["claude", "created", "Created from Claude", 5], ["client", "viewed", "Client opened the invoice", 3]],
  },
  {
    client: 0, issued: -20, due: -5, status: "paid",
    items: [["Festive packaging refresh — 2 SKUs", 2, 9500]],
    views: { first: 18, last: 9, count: 2 }, paid: { ago: 8, ref: "UPI 6021 7731 0045" },
    events: [["owner", "created", "Created by you", 20], ["client", "viewed", "Client opened the invoice", 18], ["client", "reported", "Client says paid — ref UPI 6021 7731 0045", 8], ["owner", "paid", "₹22,420.00 received — fully paid", 8]],
  },
];

export async function seedDemoData(wsId: number) {
  const s = sql();
  await s`delete from invoices where workspace_id = ${wsId}`;
  await s`delete from clients where workspace_id = ${wsId}`;
  const clientIds: number[] = [];
  for (const c of CLIENTS) {
    const [r] = await s<{ id: number }[]>`insert into clients (workspace_id, name, email, state, gstin, address)
      values (${wsId}, ${c.name}, ${c.email}, ${c.state}, ${c.gstin}, ${c.address}) returning id`;
    clientIds.push(r.id);
  }
  // Oldest first so numbers increase with date.
  const ordered = [...INVOICES].sort((a, b) => a.issued - b.issued);
  let seq = 1;
  for (const inv of ordered) {
    const issue = shift(inv.issued);
    const number = `INV/${fy(issue)}/${String(seq++).padStart(4, "0")}`;
    const token = crypto.randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
    const sub = inv.items.reduce((a, [, q, r]) => a + q * r, 0);
    const total = Math.round(sub * 1.18 * 100) / 100;
    const [row] = await s<{ id: number }[]>`
      insert into invoices (workspace_id, client_id, number, public_token, issue_date, due_date, status, notes,
        view_count, first_viewed_at, last_viewed_at, approved_at, client_query, paid_amount, paid_at, payment_ref, created_by, created_at)
      values (${wsId}, ${clientIds[inv.client]}, ${number}, ${token}, ${issue}, ${shift(inv.due)}, ${inv.status},
        ${inv.notes ?? "Payment via UPI or bank transfer. Thank you for the work!"},
        ${inv.views?.count ?? 0}, ${inv.views ? ago(inv.views.first, 3) : null}, ${inv.views ? ago(inv.views.last, 1) : null},
        ${inv.approvedAgo !== undefined ? ago(inv.approvedAgo) : null}, ${inv.query ?? null},
        ${inv.paid ? total : 0}, ${inv.paid ? ago(inv.paid.ago) : null}, ${inv.paid?.ref ?? null},
        ${inv.events[0][0] === "owner" ? "owner" : "claude"}, ${ago(-inv.issued)})
      returning id`;
    let pos = 0;
    for (const [d, q, r] of inv.items) {
      await s`insert into invoice_items (invoice_id, position, description, quantity, rate, gst_rate)
        values (${row.id}, ${pos++}, ${d}, ${q}, ${r}, 18)`;
    }
    for (const [actor, type, detail, daysAgo] of inv.events) {
      const det = type === "created" ? `Created ${number} for ${CLIENTS[inv.client].name}` : detail;
      await s`insert into events (invoice_id, actor, type, detail, created_at)
        values (${row.id}, ${actor}, ${type}, ${det}, ${ago(daysAgo, type === "created" ? 4 : 1)})`;
    }
  }
  await s`update workspaces set next_seq = ${seq} where id = ${wsId}`;
}
