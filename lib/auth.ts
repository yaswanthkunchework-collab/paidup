import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getWorkspace, type Workspace } from "./invoices";

const COOKIE = "pu_session";

function secret() {
  return (
    process.env.SESSION_SECRET ||
    crypto.createHash("sha256").update("paidup:" + (process.env.DATABASE_URL || process.env.POSTGRES_URL || "dev")).digest("hex")
  );
}

function sign(v: string) {
  return crypto.createHmac("sha256", secret()).update(v).digest("base64url");
}

export async function setSession(wsId: number) {
  const v = `${wsId}.${Date.now()}`;
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function sessionWorkspaceId(): Promise<number | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  const v = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expected = sign(v);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const id = Number(v.split(".")[0]);
  return Number.isFinite(id) ? id : null;
}

export async function requireWorkspace(): Promise<Workspace> {
  const id = await sessionWorkspaceId();
  const ws = id ? await getWorkspace(id) : null;
  if (!ws) redirect("/login");
  return ws;
}

/** For route handlers: returns workspace or null (caller sends 401). */
export async function apiWorkspace(): Promise<Workspace | null> {
  const id = await sessionWorkspaceId();
  return id ? getWorkspace(id) : null;
}
