import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getAuthSession } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar user={session.user} />
        <main className="flex-1 px-6 py-8 sm:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-16 lg:gap-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
