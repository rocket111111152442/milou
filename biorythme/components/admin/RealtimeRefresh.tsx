"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { publicClient } from "@/lib/supabase";

/** Rafraîchit la vue gérante dès qu'une séance change (réservation, annulation…). */
export default function RealtimeRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = publicClient();
    if (!client) return;
    const channel = client
      .channel("bio-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "bio_sessions" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      client.removeChannel(channel);
    };
  }, [router]);

  return null;
}
