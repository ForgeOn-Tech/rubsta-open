"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="btn btn-outline h-8 text-[12px]" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>{pending ? "Refreshing…" : "Refresh"}</button>;
}
