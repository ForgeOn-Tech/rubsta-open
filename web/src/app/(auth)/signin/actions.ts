"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth/auth";

export async function signInWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/home" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/signin?error=google");
    throw error;
  }
}

export async function signInWithDemo() {
  try {
    await signIn("demo", { redirectTo: "/home" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/signin?error=demo");
    throw error;
  }
}
