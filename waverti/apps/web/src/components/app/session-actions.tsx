"use client";
import { LogOut } from "lucide-react";
import { Button } from "@waverti/ui";
import { useApiAction } from "@/components/app/use-api";

/** Ferme toutes les autres sessions du compte (la session courante reste ouverte). */
export function CloseOtherSessions({ others }: { others: number }) {
  const { run, pending } = useApiAction();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      disabled={others === 0}
      onClick={async () => {
        await run("/api/account/sessions", {}, { method: "DELETE", success: "Les autres sessions ont été fermées" });
      }}
    >
      <LogOut aria-hidden="true" /> {others === 0 ? "Aucune autre session" : `Fermer les ${others} autre${others > 1 ? "s" : ""} session${others > 1 ? "s" : ""}`}
    </Button>
  );
}
