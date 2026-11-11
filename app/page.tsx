import Link from "next/link";

const SPLIT = [
  {
    who: "Your Claude",
    does: "Reads the email thread or chat, works out what to bill, writes the line items, and later drafts polite follow-ups.",
  },
  {
    who: "PaidUp",
    does: "Numbers the invoice, calculates GST in plain code, hosts it for your client with a UPI QR, and tracks every view, approval and payment.",
  },
  {
    who: "Your client",
    does: "Opens one link. Approves, asks a question, or pays by UPI. No login, no app to install.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-lg font-bold tracking-tight">PaidUp</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/connect" className="text-ink-soft hover:text-ink">Connect Claude</Link>
          <Link href="/login" className="btn py-1.5">Open the demo</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Bill clients from a chat.
            <br />
            Get paid from a link.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            PaidUp is invoicing and collections for Indian freelancers and small agencies, run from your own Claude. Ask Claude to bill a
            client; PaidUp turns it into a GST invoice your client can approve and pay by UPI, and shows you who still owes what.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn px-5 py-2.5">Open the demo</Link>
            <Link href="/connect" className="btn btn-quiet px-5 py-2.5">Connect your Claude</Link>
          </div>
        </div>

        <div className="relative" aria-hidden>
          <div className="ml-auto max-w-md rounded-2xl rounded-br-sm bg-ink px-4 py-3 text-sm text-white shadow-lg">
            Bill Orbit Analytics for the 14 dashboard screens and the design system kit from this thread. Due in 15 days.
          </div>
          <div className="mt-2 flex justify-end gap-1.5 text-xs text-muted">
            <span className="rounded bg-claude px-1.5 font-semibold leading-5 text-white">Claude</span> used create_invoice
          </div>
          <div className="sheet relative mt-4 rounded-lg p-6">
            <div className="flex justify-between border-b border-rule pb-3">
              <div>
                <div className="font-bold">RightPrompt Tech</div>
                <div className="text-xs text-muted">Mumbai, Maharashtra</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Tax invoice</div>
                <div className="num font-semibold">INV/26-27/0007</div>
              </div>
            </div>
            <div className="num mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Dashboard UI redesign, 14 screens</span><span>₹49,000.00</span></div>
              <div className="flex justify-between"><span>Design system starter kit</span><span>₹18,000.00</span></div>
              <div className="flex justify-between text-muted"><span>IGST 18%</span><span>₹12,060.00</span></div>
              <div className="flex justify-between border-t border-rule pt-1.5 font-semibold"><span>Total</span><span>₹79,060.00</span></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="stamp text-claude">Viewed 3×</span>
              <span className="stamp text-stamp">Approved</span>
              <span className="stamp text-ledger">4d overdue</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rule bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
          {SPLIT.map((s) => (
            <div key={s.who}>
              <h2 className="font-semibold">{s.who}</h2>
              <p className="mt-2 text-ink-soft">{s.does}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">PaidUp. Made in Mumbai for India’s freelancers and small agencies.</footer>
    </main>
  );
}
