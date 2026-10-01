"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/auth/require";
import { getDb } from "@/db/client";
import { hideMessage, muteFan, showMessage, unmuteFan } from "@/db/fan";
import { ADMIN_FAN_PATH } from "@/lib/fan-chat";
import type { ActionState } from "@/lib/form-state";

function moderated(): ActionState {
  revalidatePath(ADMIN_FAN_PATH);
  // The chat is polled, so this only matters for the first load of a court page.
  revalidatePath("/live", "layout");
  return { error: null, savedAt: Date.now() };
}

function messageIdFrom(formData: FormData): string {
  const messageId = String(formData.get("messageId") ?? "");
  if (messageId === "") throw new Error("No message was named.");
  return messageId;
}

function userIdFrom(formData: FormData): string {
  const userId = String(formData.get("userId") ?? "");
  if (userId === "") throw new Error("No fan was named.");
  return userId;
}

/** Takes a message off the court chat. It stays in the table for the record. */
export async function hideMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  hideMessage(getDb(), messageIdFrom(formData), admin.email);
  return moderated();
}

/** Puts a hidden message back on the chat. */
export async function showMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  showMessage(getDb(), messageIdFrom(formData));
  return moderated();
}

/** Stops a fan from posting. Their earlier messages are hidden one by one. */
export async function muteFanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  muteFan(getDb(), userIdFrom(formData), admin.email);
  return moderated();
}

export async function unmuteFanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  unmuteFan(getDb(), userIdFrom(formData));
  return moderated();
}
