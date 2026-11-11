import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { NewInvoiceButton } from "./NewInvoiceButton";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await requireWorkspace();
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-rule bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">PaidUp</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="link">Invoices</Link>
            <Link href="/connect" className="link">Connect Claude</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NewInvoiceButton />
            <span className="hidden items-center gap-2 border-l border-rule pl-3 text-ink sm:flex" title="Signed in as">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-desk text-[11px] font-semibold text-ink-soft">
                {initials(ws.business_name)}
              </span>
              <span className="font-medium">{ws.business_name}</span>
            </span>
            <form action="/api/logout" method="post">
              <button className="btn btn-quiet px-3 py-1.5 text-sm">Log out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
