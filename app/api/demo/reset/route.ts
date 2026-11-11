import { apiWorkspace } from "@/lib/auth";
import { seedDemoData } from "@/lib/seed";

export async function POST() {
  const ws = await apiWorkspace();
  if (!ws) return Response.json({ error: "Log in again." }, { status: 401 });
  await seedDemoData(ws.id);
  return Response.json({ ok: true });
}
