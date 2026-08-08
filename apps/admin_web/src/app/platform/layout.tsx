import "server-only";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/admin-api";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  let session;
  try {
    session = await getSession();
  } catch {
    redirect("/");
  }
  if (!session.user.is_platform_admin) {
    redirect("/");
  }
  return <>{children}</>;
}
