// Pure money + GST helpers. Plain code, no AI. Safe to import on client and server.

export type LineItem = {
  description: string;
  quantity: number;
  rate: number;
  gst_rate: number;
};

export type Totals = {
  subtotal: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  intraState: boolean;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function normState(s?: string | null) {
  return (s ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Intra-state supply (same state as the seller) -> CGST + SGST split equally.
 * Inter-state supply -> IGST. If the client's state is unknown we treat it as intra-state.
 */
export function isIntraState(sellerState?: string | null, clientState?: string | null) {
  const c = normState(clientState);
  if (!c) return true;
  return c === normState(sellerState);
}

export function computeTotals(items: LineItem[], sellerState?: string | null, clientState?: string | null): Totals {
  let subtotal = 0;
  let tax = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
    subtotal += line;
    tax += (line * (Number(it.gst_rate) || 0)) / 100;
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  const intraState = isIntraState(sellerState, clientState);
  const cgst = intraState ? round2(tax / 2) : 0;
  const sgst = intraState ? round2(tax - cgst) : 0;
  const igst = intraState ? 0 : tax;
  return { subtotal, tax, cgst, sgst, igst, total: round2(subtotal + tax), intraState };
}

export function inr(n: number, opts: { decimals?: boolean } = {}) {
  const decimals = opts.decimals ?? true;
  return (
    "₹" +
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + " " + ONES[n % 10]).trim();
}
function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + " Hundred" : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering: crore, lakh, thousand. */
export function amountInWords(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  let words = parts.join(" ") + " Rupees";
  if (paise) words += " and " + twoDigits(paise) + " Paise";
  return words + " Only";
}

export function upiLink(opts: { vpa: string; payee: string; amount: number; note: string }) {
  const p = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payee,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${p.toString()}`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  query: "Query raised",
  reported: "Payment reported",
  partial: "Part paid",
  paid: "Paid",
};

export function fmtDate(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
