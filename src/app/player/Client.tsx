"use client";
import { Lobby } from "@/components/lobby/Lobby";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/useDb";

export default function ClientHomePage({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params;
  const { user } = useSession();
  const cat = searchParams?.cat ?? "Hot";
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => { fetch("/api/public/data?view=lobby").then((response) => response.ok ? response.json() : null).then((data) => data && setLinks(data.links ?? {})).catch(() => { }); }, []);

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
