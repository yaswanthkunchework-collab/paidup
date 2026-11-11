import postgres from "postgres";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

declare global {
  // eslint-disable-next-line no-var
  var __paidupSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __paidupReady: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __paidupLastUse: number | undefined;
}

// Serverless instances are frozen between requests, and the database drops idle connections meanwhile.
// Reusing such a connection hangs until the function times out, so after an idle gap we start fresh.
const MAX_IDLE_MS = 10_000;

function makeClient() {
  if (!url) throw new Error("DATABASE_URL is not set. Add a Postgres database (e.g. Neon) to the project.");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: isLocal ? false : "require",
    max: 5,
    idle_timeout: 8,
    max_lifetime: 120,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
}

export function sql() {
  const now = Date.now();
  const stale = globalThis.__paidupLastUse !== undefined && now - globalThis.__paidupLastUse > MAX_IDLE_MS;
  if (globalThis.__paidupSql && stale) {
    const old = globalThis.__paidupSql;
    globalThis.__paidupSql = undefined;
    old.end({ timeout: 5 }).catch(() => {});
  }
  if (!globalThis.__paidupSql) globalThis.__paidupSql = makeClient();
  globalThis.__paidupLastUse = now;
  return globalThis.__paidupSql;
}

const SCHEMA = `
create table if not exists workspaces (
  id serial primary key,
  business_name text not null,
  owner_name text,
  email text,
  phone text,
  address text,
  state text,
  gstin text,
  upi_id text,
  login_username text unique not null,
  login_password text not null,
  mcp_key text unique not null,
  next_seq int not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists clients (
  id serial primary key,
  workspace_id int not null references workspaces(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  gstin text,
  state text,
  address text,
  created_at timestamptz not null default now()
);
create unique index if not exists clients_ws_name on clients (workspace_id, lower(name));
create table if not exists invoices (
  id serial primary key,
  workspace_id int not null references workspaces(id) on delete cascade,
  client_id int not null references clients(id),
  number text not null,
  public_token text unique not null,
  issue_date date not null,
  due_date date not null,
  status text not null default 'sent',
  notes text,
  view_count int not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  approved_at timestamptz,
  client_query text,
  paid_amount numeric(14,2) not null default 0,
  paid_at timestamptz,
  payment_ref text,
  created_by text not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_ws on invoices (workspace_id);
create table if not exists invoice_items (
  id serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantity numeric(12,2) not null default 1,
  rate numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null default 18
);
create table if not exists events (
  id serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  actor text not null,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists events_inv on events (invoice_id);
`;

export async function ready() {
  if (!globalThis.__paidupReady) {
    globalThis.__paidupReady = (async () => {
      const db = sql();
      await db.unsafe(SCHEMA);
      const { ensureDemoWorkspace } = await import("./seed");
      await ensureDemoWorkspace();
    })().catch((e) => {
      globalThis.__paidupReady = undefined;
      throw e;
    });
  }
  return globalThis.__paidupReady;
}

export async function db() {
  await ready();
  return sql();
}
