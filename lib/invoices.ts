import crypto from "node:crypto";
import { db } from "./db";
import { computeTotals, inr, round2, type LineItem, type Totals } from "./money";

export type Actor = "claude" | "owner" | "client" | "system";

export type Workspace = {
  id: number;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  gstin: string | null;
  upi_id: string | null;
  mcp_key: string;
};

export type ClientInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  state?: string | null;
  address?: string | null;
};

export type InvoiceRow = {
  id: number;
  number: string;
  public_token: string;
  issue_date: string;
  due_date: string;
  status: string;
  notes: string | null;
  view_count: number;
  first_viewed_at: Date | null;
  last_viewed_at: Date | null;
  approved_at: Date | null;
  client_query: string | null;
  paid_amount: number;
  paid_at: Date | null;
  payment_ref: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  client_id: number;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_gstin: string | null;
  client_state: string | null;
  client_address: string | null;
  subtotal: number;
  tax: number;
  // derived
  total: number;
  balance: number;
  overdue: boolean;
  days_overdue: number;
  days_to_due: number;
};

export type InvoiceDetail = InvoiceRow & {
  items: (LineItem & { id: number })[];
  events: { id: number; actor: string; type: string; detail: string | null; created_at: Date }[];
  totals: Totals;
};

// ---------- dates ----------

export function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
function fyLabel(date: string) {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}
function newToken() {
  return crypto.randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
}
const isDate = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

const OPEN_STATUSES = ["sent", "viewed", "approved", "query", "reported", "partial"];

// ---------- workspace ----------

export async function getWorkspace(id: number): Promise<Workspace | null> {
  const s = await db();
  const [w] = await s<Workspace[]>`select * from workspaces where id = ${id}`;
  return w ?? null;
}
export async function getWorkspaceByKey(key: string): Promise<Workspace | null> {
  const s = await db();
  const [w] = await s<Workspace[]>`select * from workspaces where mcp_key = ${key}`;
  return w ?? null;
}
export async function checkLogin(username: string, password: string): Promise<Workspace | null> {
  const s = await db();
  const [w] = await s<(Workspace & { login_password: string })[]>`
    select * from workspaces where lower(login_username) = lower(${username.trim()})`;
  if (!w) return null;
  const a = Buffer.from(w.login_password);
  const b = Buffer.from(password);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return w;
}

// ---------- clients ----------

async function upsertClient(wsId: number, c: ClientInput): Promise<number> {
  const s = await db();
  const name = (c.name ?? "").trim();
  if (!name) throw new Error("Client name is required.");
  const [existing] = await s<{ id: number }[]>`
    select id from clients where workspace_id = ${wsId} and lower(name) = lower(${name})`;
  if (existing) {
    await s`update clients set
      email = coalesce(${c.email ?? null}, email),
      phone = coalesce(${c.phone ?? null}, phone),
      gstin = coalesce(${c.gstin ?? null}, gstin),
      state = coalesce(${c.state ?? null}, state),
      address = coalesce(${c.address ?? null}, address)
      where id = ${existing.id}`;
    return existing.id;
  }
  const [row] = await s<{ id: number }[]>`
    insert into clients (workspace_id, name, email, phone, gstin, state, address)
    values (${wsId}, ${name}, ${c.email ?? null}, ${c.phone ?? null}, ${c.gstin ?? null}, ${c.state ?? null}, ${c.address ?? null})
    returning id`;
  return row.id;
}

// ---------- reads ----------

function derive(r: Omit<InvoiceRow, "total" | "balance" | "overdue" | "days_overdue" | "days_to_due">): InvoiceRow {
  const total = round2(Number(r.subtotal) + Number(r.tax));
  const paid = Number(r.paid_amount);
  const balance = round2(Math.max(0, total - paid));
  const today = todayIST();
  const dd = daysBetween(r.due_date, today);
  const overdue = OPEN_STATUSES.includes(r.status) && dd > 0 && balance > 0;
  return {
    ...r,
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    paid_amount: paid,
    total,
    balance,
    overdue,
    days_overdue: overdue ? dd : 0,
    days_to_due: -dd,
  };
}

async function selectInvoices(wsId: number, where: (s: Awaited<ReturnType<typeof db>>) => unknown) {
  const s = await db();
  const rows = await s`
    select i.id, i.number, i.public_token, i.issue_date::text as issue_date, i.due_date::text as due_date,
      i.status, i.notes, i.view_count, i.first_viewed_at, i.last_viewed_at, i.approved_at, i.client_query,
      i.paid_amount::float8 as paid_amount, i.paid_at, i.payment_ref, i.created_by, i.created_at, i.updated_at,
      c.id as client_id, c.name as client_name, c.email as client_email, c.phone as client_phone,
      c.gstin as client_gstin, c.state as client_state, c.address as client_address,
      coalesce(t.subtotal, 0)::float8 as subtotal, coalesce(t.tax, 0)::float8 as tax
    from invoices i
    join clients c on c.id = i.client_id
    left join lateral (
      select round(sum(quantity * rate), 2) as subtotal,
             round(sum(quantity * rate * gst_rate / 100), 2) as tax
      from invoice_items where invoice_id = i.id
    ) t on true
    where i.workspace_id = ${wsId} ${where(s) as never}
    order by i.issue_date desc, i.id desc`;
  return (rows as unknown as Parameters<typeof derive>[0][]).map(derive);
}

/** Look up by numeric id, invoice number (e.g. INV/26-27/0007 or just 7 / 0007), or public token. */
export async function findInvoice(wsId: number, ref: string | number): Promise<InvoiceRow | null> {
  const r = String(ref).trim();
  const rows = await selectInvoices(wsId, (s) =>
    /^\d+$/.test(r)
      ? s`and (i.id = ${Number(r)} or i.number ilike ${"%/" + r.padStart(4, "0")})`
      : s`and (lower(i.number) = lower(${r}) or i.public_token = ${r})`,
  );
  if (/^\d+$/.test(r)) {
    // prefer exact id match
    return rows.find((x) => x.id === Number(r)) ?? rows[0] ?? null;
  }
  return rows[0] ?? null;
}

export async function getInvoiceDetail(wsId: number, ref: string | number, sellerState: string | null): Promise<InvoiceDetail | null> {
  const inv = await findInvoice(wsId, ref);
  if (!inv) return null;
  const s = await db();
  const items = await s<(LineItem & { id: number })[]>`
    select id, description, quantity::float8 as quantity, rate::float8 as rate, gst_rate::float8 as gst_rate
    from invoice_items where invoice_id = ${inv.id} order by position, id`;
  const events = await s<InvoiceDetail["events"]>`
    select id, actor, type, detail, created_at from events where invoice_id = ${inv.id} order by created_at desc, id desc`;
  return { ...inv, items, events, totals: computeTotals(items, sellerState, inv.client_state) };
}

export type ListFilter = "all" | "unpaid" | "overdue" | "draft" | "sent" | "viewed" | "approved" | "query" | "reported" | "paid";

export async function listInvoices(wsId: number, opts: { filter?: ListFilter; client?: string; limit?: number } = {}) {
  const filter = opts.filter ?? "all";
  let rows = await selectInvoices(wsId, (s) =>
    opts.client ? s`and c.name ilike ${"%" + opts.client + "%"}` : s``,
  );
  if (filter === "unpaid") rows = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  else if (filter === "overdue") rows = rows.filter((r) => r.overdue).sort((a, b) => b.days_overdue - a.days_overdue);
  else if (filter !== "all") rows = rows.filter((r) => r.status === filter);
  return rows.slice(0, opts.limit ?? 200);
}

export async function summary(wsId: number) {
  const rows = await listInvoices(wsId, { filter: "all" });
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const overdue = open.filter((r) => r.overdue);
  const today = todayIST();
  const paid30 = rows.filter(
    (r) => r.paid_at && daysBetween(new Date(r.paid_at).toISOString().slice(0, 10), today) <= 30,
  );
  const bucket = (lo: number, hi: number) => {
    const b = overdue.filter((r) => r.days_overdue >= lo && r.days_overdue <= hi);
    return { count: b.length, amount: round2(b.reduce((a, r) => a + r.balance, 0)) };
  };
  const byClient = new Map<string, { client: string; outstanding: number; overdue: number; invoices: number }>();
  for (const r of open) {
    const e = byClient.get(r.client_name) ?? { client: r.client_name, outstanding: 0, overdue: 0, invoices: 0 };
    e.outstanding = round2(e.outstanding + r.balance);
    if (r.overdue) e.overdue = round2(e.overdue + r.balance);
    e.invoices++;
    byClient.set(r.client_name, e);
  }
  return {
    outstanding: { count: open.length, amount: round2(open.reduce((a, r) => a + r.balance, 0)) },
    overdue: { count: overdue.length, amount: round2(overdue.reduce((a, r) => a + r.balance, 0)) },
    paid_last_30_days: { count: paid30.length, amount: round2(paid30.reduce((a, r) => a + r.paid_amount, 0)) },
    needs_attention: rows.filter((r) => r.status === "query" || r.status === "reported").length,
    aging: {
      "1-15 days": bucket(1, 15),
      "16-30 days": bucket(16, 30),
      "31-60 days": bucket(31, 60),
      "60+ days": bucket(61, 100000),
    },
    by_client: [...byClient.values()].sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding),
    overdue_invoices: overdue.sort((a, b) => b.days_overdue - a.days_overdue),
    open_invoices: open,
  };
}

// ---------- writes ----------

async function logEvent(invoiceId: number, actor: Actor, type: string, detail?: string) {
  const s = await db();
  await s`insert into events (invoice_id, actor, type, detail) values (${invoiceId}, ${actor}, ${type}, ${detail ?? null})`;
}

function cleanItems(items: Partial<LineItem>[]): LineItem[] {
  return items
    .map((it) => ({
      description: String(it.description ?? "").trim(),
      quantity: Number(it.quantity ?? 1),
      rate: Number(it.rate ?? 0),
      gst_rate: it.gst_rate === undefined || it.gst_rate === null ? 18 : Number(it.gst_rate),
    }))
    .filter((it) => it.description || it.rate);
}

async function writeItems(invoiceId: number, items: LineItem[]) {
  const s = await db();
  await s`delete from invoice_items where invoice_id = ${invoiceId}`;
  let pos = 0;
  for (const it of items) {
    await s`insert into invoice_items (invoice_id, position, description, quantity, rate, gst_rate)
      values (${invoiceId}, ${pos++}, ${it.description || "Item"}, ${it.quantity}, ${it.rate}, ${it.gst_rate})`;
  }
}

export type CreateInput = {
  client: ClientInput & { name: string };
  items: Partial<LineItem>[];
  issue_date?: string;
  due_date?: string;
  due_in_days?: number;
  notes?: string;
  status?: "draft" | "sent";
};

export async function createInvoice(wsId: number, input: CreateInput, actor: Actor) {
  const s = await db();
  const items = cleanItems(input.items ?? []);
  const issue = isDate(input.issue_date) ? input.issue_date! : todayIST();
  const due = isDate(input.due_date) ? input.due_date! : addDays(issue, input.due_in_days ?? 15);
  const clientId = await upsertClient(wsId, input.client);
  const [{ next_seq }] = await s<{ next_seq: number }[]>`
    update workspaces set next_seq = next_seq + 1 where id = ${wsId} returning next_seq - 1 as next_seq`;
  const number = `INV/${fyLabel(issue)}/${String(next_seq).padStart(4, "0")}`;
  const [row] = await s<{ id: number }[]>`
    insert into invoices (workspace_id, client_id, number, public_token, issue_date, due_date, status, notes, created_by)
    values (${wsId}, ${clientId}, ${number}, ${newToken()}, ${issue}, ${due}, ${input.status ?? "sent"}, ${input.notes ?? null}, ${actor})
    returning id`;
  await writeItems(row.id, items);
  await logEvent(row.id, actor, "created", `Created ${number} for ${input.client.name}`);
  return row.id;
}

export type UpdateInput = {
  client?: ClientInput;
  items?: Partial<LineItem>[];
  issue_date?: string;
  due_date?: string;
  notes?: string | null;
  status?: "draft" | "sent";
};

export async function updateInvoice(wsId: number, id: number, patch: UpdateInput, actor: Actor) {
  const s = await db();
  const inv = await findInvoice(wsId, id);
  if (!inv) throw new Error("Invoice not found.");
  const changes: string[] = [];

  if (patch.client) {
    const newName = patch.client.name?.trim();
    if (newName && newName.toLowerCase() !== inv.client_name.toLowerCase()) {
      const cid = await upsertClient(wsId, { ...patch.client, name: newName });
      await s`update invoices set client_id = ${cid} where id = ${inv.id}`;
      changes.push(`client → ${newName}`);
    } else {
      const c = patch.client;
      await s`update clients set
        email = ${c.email !== undefined ? c.email : inv.client_email},
        phone = ${c.phone !== undefined ? c.phone : inv.client_phone},
        gstin = ${c.gstin !== undefined ? c.gstin : inv.client_gstin},
        state = ${c.state !== undefined ? c.state : inv.client_state},
        address = ${c.address !== undefined ? c.address : inv.client_address}
        where id = ${inv.client_id}`;
      const fields = (["email", "phone", "gstin", "state", "address"] as const).filter(
        (f) => c[f] !== undefined && (c[f] ?? "") !== ((inv as unknown as Record<string, string | null>)["client_" + f] ?? ""),
      );
      if (fields.length) changes.push(`client ${fields.join(", ")}`);
    }
  }
  if (patch.items) {
    await writeItems(inv.id, cleanItems(patch.items));
    changes.push("line items");
  }
  if (isDate(patch.issue_date) && patch.issue_date !== inv.issue_date) {
    await s`update invoices set issue_date = ${patch.issue_date!} where id = ${inv.id}`;
    changes.push(`issue date → ${patch.issue_date}`);
  }
  if (isDate(patch.due_date) && patch.due_date !== inv.due_date) {
    await s`update invoices set due_date = ${patch.due_date!} where id = ${inv.id}`;
    changes.push(`due date → ${patch.due_date}`);
  }
  if (patch.notes !== undefined && (patch.notes ?? "") !== (inv.notes ?? "")) {
    await s`update invoices set notes = ${patch.notes} where id = ${inv.id}`;
    changes.push("notes");
  }
  if (patch.status && patch.status !== inv.status && ["draft", "sent"].includes(inv.status)) {
    await s`update invoices set status = ${patch.status} where id = ${inv.id}`;
    changes.push(`marked ${patch.status}`);
  }
  await s`update invoices set updated_at = now() where id = ${inv.id}`;
  if (changes.length) await logEvent(inv.id, actor, "edited", `Edited ${changes.join(", ")}`);
  return { id: inv.id, changes };
}

export async function markSent(wsId: number, id: number, actor: Actor) {
  const s = await db();
  const r = await s`update invoices set status = 'sent', updated_at = now()
    where id = ${id} and workspace_id = ${wsId} and status = 'draft' returning id`;
  if (r.length) await logEvent(id, actor, "sent", "Marked as sent");
}

/** Records a successful email to the client: drafts become 'sent'; later statuses are kept. */
export async function markEmailed(wsId: number, id: number, to: string, resend: boolean, actor: Actor) {
  const s = await db();
  await s`update invoices set status = case when status = 'draft' then 'sent' else status end, updated_at = now()
    where id = ${id} and workspace_id = ${wsId}`;
  await logEvent(id, actor, "emailed", `${resend ? "Re-sent" : "Emailed"} to ${to}`);
}

export async function recordPayment(
  wsId: number,
  id: number,
  p: { amount?: number; paid_on?: string; reference?: string },
  actor: Actor,
) {
  const s = await db();
  const inv = await findInvoice(wsId, id);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "paid") return { already: true, inv };
  const amount = round2(p.amount && p.amount > 0 ? p.amount : inv.balance);
  const newPaid = round2(inv.paid_amount + amount);
  const full = newPaid >= inv.total - 0.01;
  const paidAt = isDate(p.paid_on) ? new Date(p.paid_on + "T12:00:00+05:30") : new Date();
  await s`update invoices set paid_amount = ${newPaid}, status = ${full ? "paid" : "partial"},
    paid_at = ${full ? paidAt : null}, payment_ref = coalesce(${p.reference ?? null}, payment_ref), updated_at = now()
    where id = ${inv.id}`;
  await logEvent(
    inv.id,
    actor,
    "paid",
    `${inr(amount)} received${p.reference ? ` (ref ${p.reference})` : ""}${full ? " — fully paid" : ` — ${inr(round2(inv.total - newPaid))} still due`}`,
  );
  return { already: false, full, amount, inv };
}

export async function deleteInvoice(wsId: number, id: number) {
  const s = await db();
  await s`delete from invoices where id = ${id} and workspace_id = ${wsId}`;
}

// ---------- public (client-facing) ----------

export async function getPublicInvoice(token: string) {
  const s = await db();
  const [r] = await s<{ workspace_id: number; id: number }[]>`select workspace_id, id from invoices where public_token = ${token}`;
  if (!r) return null;
  const ws = await getWorkspace(r.workspace_id);
  if (!ws) return null;
  const inv = await getInvoiceDetail(ws.id, r.id, ws.state);
  if (!inv) return null;
  return { ws, inv };
}

export async function recordView(invoiceId: number) {
  const s = await db();
  const [r] = await s<{ last_viewed_at: Date | null; status: string }[]>`
    select last_viewed_at, status from invoices where id = ${invoiceId}`;
  if (!r) return;
  const fresh = !r.last_viewed_at || Date.now() - new Date(r.last_viewed_at).getTime() > 10 * 60 * 1000;
  if (!fresh) return;
  await s`update invoices set view_count = view_count + 1, last_viewed_at = now(),
    first_viewed_at = coalesce(first_viewed_at, now()),
    status = case when status in ('sent', 'draft') then 'viewed' else status end
    where id = ${invoiceId}`;
  await logEvent(invoiceId, "client", "viewed", "Client opened the invoice");
}

export async function clientAction(token: string, action: "approve" | "query" | "reported", message?: string) {
  const s = await db();
  const [r] = await s<{ id: number; status: string }[]>`select id, status from invoices where public_token = ${token}`;
  if (!r) throw new Error("Invoice not found.");
  if (r.status === "paid") return;
  if (r.status === "draft") throw new Error("Invoice not found.");
  const msg = (message ?? "").trim().slice(0, 1000) || null;
  if (action === "approve") {
    await s`update invoices set status = 'approved', approved_at = now(), updated_at = now() where id = ${r.id}`;
    await logEvent(r.id, "client", "approved", msg ?? "Client approved the invoice");
  } else if (action === "query") {
    await s`update invoices set status = 'query', client_query = ${msg}, updated_at = now() where id = ${r.id}`;
    await logEvent(r.id, "client", "query", msg ?? "Client raised a query");
  } else {
    await s`update invoices set status = 'reported', payment_ref = coalesce(${msg}, payment_ref), updated_at = now() where id = ${r.id}`;
    await logEvent(r.id, "client", "reported", msg ? `Client says paid — ref ${msg}` : "Client says they have paid");
  }
}
