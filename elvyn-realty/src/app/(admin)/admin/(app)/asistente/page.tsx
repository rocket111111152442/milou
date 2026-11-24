import { env } from "@/config/env";
import { creditStatus, purchaseHistory } from "@/lib/ai/credits";
import { paymentsConfigured } from "@/lib/payments/stripe";
import { Card, Empty, fmtDate } from "@/components/admin/ui";
import { TokenGauge } from "@/components/admin/TokenGauge";
import { TopUp } from "@/components/admin/TopUp";

export const metadata = { title: "Asistente IA" };
export const dynamic = "force-dynamic";

export default async function AssistantCredits({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  const [s, history] = await Promise.all([creditStatus(), purchaseHistory()]);
  const cur = (c: string | null) => (c ?? env.stripe.currency).toUpperCase();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Asistente IA</h1>
      {pago === "ok" && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          Pago recibido. Los tokens se añaden en cuanto Stripe confirma el pago (normalmente en unos segundos). Recarga la página si el porcentaje aún no ha cambiado.
        </p>
      )}
      {pago === "cancelado" && <p role="status" className="rounded-xl bg-navy-50 p-3 text-sm">Pago cancelado. No se ha cobrado nada.</p>}
      <Card title="Tokens del asistente">
        <TokenGauge s={s} />
        <p className="mt-3 text-xs text-ink-muted">
          El porcentaje se calcula sobre la última recarga. El número de mensajes es una estimación según el uso real de los últimos 30 días; varía según la longitud de las conversaciones.
        </p>
      </Card>
      <Card title="Recargar tokens">
        <TopUp packs={env.stripe.packs} currency={env.stripe.currency} min={env.stripe.minAmount} max={env.stripe.maxAmount} enabled={paymentsConfigured()} />
      </Card>
      <Card title="Historial de recargas">
        {history.length === 0 ? (
          <Empty>Todavía no hay recargas.</Empty>
        ) : (
          <ul className="divide-y divide-navy-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between py-2.5">
                <span>{fmtDate(h.createdAt)}</span>
                <span className="font-medium">{h.paidAmount?.toLocaleString("es-DO", { minimumFractionDigits: 2 })} {cur(h.paidCurrency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
