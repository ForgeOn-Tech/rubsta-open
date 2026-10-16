"use client";
import { useActionState } from "react";

import type { CertificateKind } from "@/lib/certificates";
import { emailAllCertificates, emailCertificate, type EmailActionState } from "./actions";

const INITIAL: EmailActionState = { error: null, message: null };

function Feedback({ state }: { state: EmailActionState }) {
  if (state.error) return <p role="alert" className="text-[12px] text-bad">{state.error}</p>;
  if (state.message) return <p role="status" className="text-[12px]">{state.message}</p>;
  return null;
}

export function EmailAllButton({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(emailAllCertificates, INITIAL);
  return <form action={action} className="flex flex-col items-start gap-2">
    <button type="submit" className="btn btn-primary" style={{ color: "var(--color-accent-fg)" }} disabled={disabled || pending}>
      {pending ? "Preparing certificates…" : "Email all certificates"}
    </button>
    <Feedback state={state} />
  </form>;
}

export function EmailOneButton({ userId, entryId, kind, sentBefore, waiting }: { userId: string; entryId: string; kind: CertificateKind; sentBefore: boolean; waiting: boolean }) {
  const [state, action, pending] = useActionState(emailCertificate, INITIAL);
  return <form action={action} className="flex flex-col items-start gap-1">
    <input type="hidden" name="userId" value={userId} />
    <input type="hidden" name="entryId" value={entryId} />
    <input type="hidden" name="kind" value={kind} />
    <button type="submit" className="btn btn-outline" disabled={pending || waiting}>
      {pending ? "Queuing…" : waiting ? "Waiting to send" : sentBefore ? "Email again" : "Email"}
    </button>
    <Feedback state={state} />
  </form>;
}
