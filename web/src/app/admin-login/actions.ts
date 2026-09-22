"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth/auth";

export async function adminPasswordLogin(_previous: { error: string }, form: FormData) {
  try {
    await signIn("admin-password", {
      username: form.get("username"), password: form.get("password"), redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Unable to sign in. Check your username and password. After repeated attempts, wait 10 minutes before trying again." };
    throw error;
  }
  return { error: "" };
}
