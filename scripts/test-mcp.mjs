// Usage: node scripts/test-mcp.mjs <mcp-url>
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2];
const client = new Client({ name: "paidup-test", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
console.log("instructions:", client.getInstructions()?.slice(0, 80));
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n=== ${name} ${r.isError ? "(ERROR)" : ""}\n` + r.content.map((c) => c.text).join("\n"));
  return r;
};
await call("create_invoice", {
  client: { name: "Acme Media", email: "ap@acmemedia.example", state: "Karnataka" },
  items: [{ description: "Blog post — 1,500 words", quantity: 3, rate: 6000 }, { description: "Landing page copy", rate: 9000 }],
  due_in_days: 15,
});
await call("list_invoices", { filter: "overdue" });
await call("update_invoice", { invoice: "7", due_date: "2026-12-01", notes: "Thanks!" });
await call("get_receivables_summary", {});
await call("mark_paid", { invoice: "7", amount: 10000, reference: "UTR123" });
await call("get_invoice", { invoice: "INV/26-27/0007" });
await client.close();
