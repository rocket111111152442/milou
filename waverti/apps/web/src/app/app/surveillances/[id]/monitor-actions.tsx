"use client";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@waverti/ui";
import { useApiAction } from "@/components/app/use-api";

export function MonitorActions({ id, status, canExport }: { id: string; status: string; canExport: boolean }) {
  const { run, pending } = useApiAction();
  const router = useRouter();
  const paused = status === "paused" || status === "paused_quota";
  return (
    <>
      <Button size="sm" loading={pending} disabled={paused} onClick={() => run(`/api/monitors/${id}/check`, {}, { success: "Vérification demandée" })}>
        <RefreshCw aria-hidden="true" /> Vérifier maintenant
      </Button>
      <Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon-sm" aria-label="Autres actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {paused ? (
              <DropdownMenuItem onSelect={() => run(`/api/monitors/${id}/resume`, {}, { success: "Surveillance reprise" })}>
                <Play /> Reprendre
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => run(`/api/monitors/${id}/pause`, {}, { success: "Surveillance en pause" })}>
                <Pause /> Mettre en pause
              </DropdownMenuItem>
            )}
            {canExport ? (
              <DropdownMenuItem asChild>
                <a href={`/api/monitors/${id}/export`}>
                  <Download /> Exporter l'historique (CSV)
                </a>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DialogTrigger asChild>
              <DropdownMenuItem destructive>
                <Trash2 /> Supprimer
              </DropdownMenuItem>
            </DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent title="Supprimer cette surveillance ?" description="Son historique sera supprimé définitivement. Les alertes déjà reçues restent visibles.">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                const r = await run(`/api/monitors/${id}`, undefined, { method: "DELETE", success: "Surveillance supprimée", refresh: false });
                if (r) router.push("/app/surveillances");
              }}
            >
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
