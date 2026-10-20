"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth/auth";
import { umpireLinkPath } from "@/lib/umpire-links";

/** Signs this phone in as the link's umpire and opens their matches. */
export async function startScoring(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  try {
    await signIn("umpire-link", { token, redirectTo: "/score" });
  } catch (error) {
    // The link was revoked or lapsed between opening the page and pressing the button.
    if (error instanceof AuthError) redirect(umpireLinkPath(token));
    throw error;
  }
}
