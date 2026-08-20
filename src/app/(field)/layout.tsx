import { redirect } from "next/navigation";
import { FieldShell } from "@/components/field/FieldShell";
import { resolveLiveSession } from "@/lib/session";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveLiveSession();
  if (!session) redirect("/login?reason=stale&callbackUrl=/m");

  return <FieldShell>{children}</FieldShell>;
}
