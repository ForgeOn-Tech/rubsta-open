import { redirect } from "next/navigation";

import { auth } from "@/auth/auth";

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  const session = await auth();
  redirect(session?.user?.id ? "/home" : "/signin");
}
