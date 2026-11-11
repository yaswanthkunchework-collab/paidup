import { headers } from "next/headers";
import { requireWorkspace } from "@/lib/auth";
import { baseUrl } from "@/lib/url";
import { CopyButton } from "@/components/CopyButton";
import { ResetDemo } from "./ResetDemo";

const PROMPTS = [
  "Invoice Acme Media for 3 blog posts at ₹6,000 each and landing page copy for ₹9,000. They're in Bengaluru, Karnataka. Due in 15 days.",
  "Here's my email thread with the client — work out what I should bill and create the invoice: [paste thread]",
  "Who owes me money? Rank who I should chase first and draft a WhatsApp follow-up for each.",
  "Orbit Analytics paid ₹50,000 today by UPI, ref 4471 2290. Record it.",
  "Push the due date on the Lotus Wellness invoice by a week and add a 10% discount line.",
];

export default async function ConnectPage() {
  const ws = await requireWorkspace();
  const mcpUrl = `${baseUrl({ headers: await headers() })}/w/${ws.mcp_key}/mcp`;
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Connect your Claude</h1>
      <p className="mt-1 text-ink-soft">
        Claude does the reading and writing. PaidUp saves the invoice, hosts it for your client and tracks payment. Setup takes about a minute.
      </p>

      <section className="sheet mt-6 rounded-lg p-5">
        <div className="text-sm text-muted">Your PaidUp connector link</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="num min-w-0 flex-1 break-all rounded-md bg-desk px-3 py-2 text-sm">{mcpUrl}</code>
          <CopyButton text={mcpUrl} label="Copy link" />
        </div>
        <p className="mt-2 text-xs text-muted">Keep this private: anyone with this link can create invoices in your account.</p>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Add it to Claude</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">
          <li>In Claude (web or desktop), open <span className="font-medium text-ink">Customize → Connectors</span> (or Settings → Connectors) and choose <span className="font-medium text-ink">Add custom connector</span>.</li>
          <li>Name it <span className="font-medium text-ink">PaidUp</span>, paste the link above, and click <span className="font-medium text-ink">Add</span>. No sign-in is needed.</li>
          <li>In a new chat, make sure PaidUp is switched on in the connectors menu, then ask for something below.</li>
        </ol>
        <p className="mt-3 text-sm text-muted">Works on every Claude plan. Free plans allow one custom connector.</p>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Things to ask Claude</h2>
        <ul className="mt-3 space-y-2">
          {PROMPTS.map((p) => (
            <li key={p} className="sheet flex items-start justify-between gap-3 rounded-lg p-3 text-sm">
              <span>{p}</span>
              <CopyButton text={p} label="Copy" className="btn btn-quiet shrink-0 px-2.5 py-1 text-xs" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="font-semibold">Demo data</h2>
        <p className="mt-1 text-sm text-muted">Put the sample clients and invoices back the way they started. Invoices you created will be removed.</p>
        <ResetDemo />
      </section>
    </main>
  );
}
