import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { NewInvoiceButton } from "./NewInvoiceButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await requireWorkspace();
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-rule bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">PaidUp</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-ink-soft hover:text-ink">Invoices</Link>
            <Link href="/connect" className="text-ink-soft hover:text-ink">Connect Claude</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{ws.business_name}</span>
            <NewInvoiceButton />
            <form action="/api/logout" method="post">
              <button className="text-muted hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
