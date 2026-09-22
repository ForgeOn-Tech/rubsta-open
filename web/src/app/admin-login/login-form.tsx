"use client";

import { useActionState } from "react";
import { adminPasswordLogin } from "./actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminPasswordLogin, { error: "" });
  return <form action={action} className="mt-7 flex flex-col gap-5">
    <label className="text-sm">Username<input className="field" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} /></label>
    <label className="text-sm">Password<input className="field" name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
    {state.error && <p className="text-sm leading-6 text-bad" role="alert">{state.error}</p>}
    <button className="btn btn-primary w-full" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in to admin"}</button>
  </form>;
}
