import { env } from "@/config/env";
import { listNotifications } from "@/lib/crm/queries";
import { Empty, fmtDate } from "@/components/admin/ui";
import { retryNotification } from "../../actions";

export const metadata = { title: "Notificaciones" };

export default async function Notifications() {
  const rows = await listNotifications();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">Notificaciones</h1>
      <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
        Modo: <strong>{env.notify.mode === "live" ? "envío real" : "prueba (se registran aquí, no se envía nada)"}</strong> · Eventos: {env.notify.events.join(", ")} · Destinatarios correo: {env.notify.emailTo.length ? env.notify.emailTo.join(", ") : "no configurados"} · WhatsApp automático: {env.notify.whatsapp.enabled ? "activado" : "desactivado"}
      </p>
      {rows.length === 0 ? <Empty>Sin notificaciones todavía.</Empty> : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id} className="rounded-2xl border border-navy-100 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p><strong>{n.subject ?? n.event}</strong> · {n.channel} → {n.recipient}</p>
                <p className="text-xs text-ink-soft">{fmtDate(n.createdAt)} · estado: <strong>{n.status}</strong>{n.attempts ? ` · intentos: ${n.attempts}` : ""}</p>
              </div>
              {n.lastError && <p className="mt-1 text-xs text-red-700">{n.lastError}</p>}
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-navy-50 p-2 text-xs">{n.body}</pre>
              {n.status === "failed" && (
                <form action={retryNotification} className="mt-2"><input type="hidden" name="id" value={n.id} /><button className="btn-outline min-h-[36px] text-xs">Reintentar</button></form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
