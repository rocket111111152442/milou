"use client";
import { CheckCheck } from "lucide-react";
import { Button } from "@watchly/ui";
import { useApiAction } from "@/components/app/use-api";

export function AlertsActions({ hasUnread }: { hasUnread: boolean }) {
  const { run, pending } = useApiAction();
  return (
    <Button variant="secondary" size="sm" disabled={!hasUnread} loading={pending} onClick={() => run("/api/notifications/read", { all: true }, { success: "Toutes les alertes sont lues" })}>
      <CheckCheck aria-hidden="true" /> Tout marquer comme lu
    </Button>
  );
}
