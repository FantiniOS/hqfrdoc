import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { HqShell } from "@/components/HqShell";

export const dynamic = "force-dynamic";

export default async function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  return <HqShell username={session.sub}>{children}</HqShell>;
}
