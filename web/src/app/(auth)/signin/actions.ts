"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth/auth";
import { afterSignInPath, signInPathFor } from "@/lib/sign-in-return";

/** The page the sign-in form asked to come back to; anything off this site goes home. */
function returnPath(formData: FormData): string {
  return afterSignInPath(String(formData.get("next") ?? ""));
}

export async function signInWithGoogle(formData: FormData) {
  const next = returnPath(formData);
  try {
    await signIn("google", { redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) redirect(`${signInPathFor(next)}&error=google`);
    throw error;
  }
}

export async function signInWithDemo(formData: FormData) {
  const next = returnPath(formData);
  try {
    await signIn("demo", { redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) redirect(`${signInPathFor(next)}&error=demo`);
    throw error;
  }
}
