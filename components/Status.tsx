import { STATUS_LABEL } from "@/lib/money";

const TONE: Record<string, string> = {
  draft: "text-muted",
  sent: "text-muted",
  viewed: "text-ink",
  approved: "text-stamp",
  query: "text-amber",
  reported: "text-amber",
  partial: "text-amber",
  paid: "text-stamp",
};

export function StatusStamp({ status, overdueDays }: { status: string; overdueDays?: number }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={`stamp ${TONE[status] ?? "text-ink"}`}>{STATUS_LABEL[status] ?? status}</span>
      {overdueDays ? <span className="stamp text-ledger">{overdueDays}d overdue</span> : null}
    </span>
  );
}

const ACTOR: Record<string, { label: string; cls: string }> = {
  claude: { label: "Claude", cls: "bg-claude text-white" },
  owner: { label: "You", cls: "bg-ink text-white" },
  client: { label: "Client", cls: "bg-stamp text-white" },
  system: { label: "PaidUp", cls: "bg-muted text-white" },
};

export function ActorTag({ actor }: { actor: string }) {
  const a = ACTOR[actor] ?? ACTOR.system;
  return <span className={`inline-block rounded px-1.5 text-[11px] font-semibold leading-5 ${a.cls}`}>{a.label}</span>;
}
