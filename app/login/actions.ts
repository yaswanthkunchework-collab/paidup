"use server";
import { redirect } from "next/navigation";
import { checkLogin } from "@/lib/invoices";
import { setSession } from "@/lib/auth";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const ws = await checkLogin(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (!ws) return "That email and password don't match. Use the demo login shown below.";
  await setSession(ws.id);
  redirect("/dashboard");
}
