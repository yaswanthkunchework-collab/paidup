import Link from "next/link";
import { DEMO } from "@/lib/seed";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 text-2xl font-bold tracking-tight">PaidUp</Link>
      <h1 className="text-xl font-semibold">Log in to your ledger</h1>
      <p className="mb-6 mt-1 text-sm text-muted">See what Claude created, edit it, and track who has paid.</p>
      <LoginForm demoUser={DEMO.username} demoPass={DEMO.password} />
      <div className="mt-6 rounded-md border border-dashed border-rule bg-white/60 p-3 text-sm text-ink-soft">
        Demo account (pre-filled): <span className="num font-medium text-ink">{DEMO.username}</span> / <span className="num font-medium text-ink">{DEMO.password}</span>
      </div>
    </main>
  );
}
