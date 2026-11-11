"use client";
import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ demoUser, demoPass }: { demoUser: string; demoPass: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm text-ink-soft">Email</span>
        <input name="username" type="email" required defaultValue={demoUser} className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm text-ink-soft">Password</span>
        <input name="password" type="password" required defaultValue={demoPass} className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2" />
      </label>
      {error && <p className="text-sm text-ledger">{error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
