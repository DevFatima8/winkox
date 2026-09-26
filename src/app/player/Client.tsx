"use client";
import { Lobby } from "@/components/lobby/Lobby";
import { useDb, useSession } from "@/lib/useDb";
import { getSettings } from "@/lib/platform";
import { dbConnect } from "@/lib/mongo";

export default function ClientHomePage({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params;
  const { user } = useSession();
  const cat = searchParams?.cat ?? "Hot";
  const { data: links } = useDb(async () => {
    await dbConnect();
    const s = await getSettings();
    return { ...(s.links ?? {}), androidUrl: s.app?.androidUrl, iosUrl: s.app?.iosUrl };
  }, []);

  return (
    <Lobby
      viewer={{
        loggedIn: !!user,
        isAdmin: user?.role === "admin",
        name: user?.name,
        balance: user?.balance,
      }}
      cat={cat}
      links={links ?? {}}
      showHeader={false}
    />
  );
}
