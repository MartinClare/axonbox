import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AskDock } from "@/components/AskDock";
import { resolveLiveSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveLiveSession();
  if (!session) redirect("/login?reason=stale");

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-[5.5rem] md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <AskDock />
    </div>
  );
}
