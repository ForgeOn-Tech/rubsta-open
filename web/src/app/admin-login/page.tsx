import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { canAccessAdmin } from "@/auth/require";
import { adminPasswordConfigured } from "@/auth/admin-password";
import { AdminLoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team login · Rubsta Open", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.email && canAccessAdmin(session.user.email)) redirect("/admin");
  return <main className="flex min-h-screen items-center justify-center bg-club-cream px-5 py-12">
    <section className="card w-full max-w-sm p-8">
      <p className="eyebrow">Rubsta Open · Team access</p>
      <h1 className="mt-3 text-2xl font-semibold">Admin sign in</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Use your team username and password to manage the tournament.</p>
      {adminPasswordConfigured() ? <AdminLoginForm /> : <p className="mt-6 text-sm" role="status">Password login has not been configured for this environment.</p>}
      <Link className="mt-6 block text-xs" href="/signin">Player or Google sign-in →</Link>
    </section>
  </main>;
}
