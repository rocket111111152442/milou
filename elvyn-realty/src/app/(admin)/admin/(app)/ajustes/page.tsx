import { env, catalogMode, crmStorageConfigured } from "@/config/env";
import { PIPELINE, QUALIFICATION } from "@/config/crm";
import { catalogStatus } from "@/lib/catalog/service";
import { assistantAvailable } from "@/lib/ai/agent";
import { usageSummary } from "@/lib/ai/usage";
import { getCalendar } from "@/lib/calendar";
import { KNOWLEDGE_VERSION } from "@/lib/ai/knowledge";
import { Card, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Configuración" };

function Row({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-b border-navy-100 py-2.5 text-sm">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium">{ok === undefined ? null : <span aria-hidden className={ok ? "text-emerald-700" : "text-amber-700"}>{ok ? "● " : "○ "}</span>}{v}</dd>
    </div>
  );
}

export default async function Settings() {
  const cs = catalogStatus();
  const ai = assistantAvailable();
  const usage = await usageSummary();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Configuración</h1>
      <p className="text-sm text-ink-muted">Estado de las integraciones (solo lectura). Los valores se cambian con variables de entorno en el alojamiento; ver README. Ninguna clave se muestra aquí.</p>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Catálogo AlterEstate">
          <dl>
            <Row k="Modo" v={catalogMode() === "live" ? "Conectado (clave pública configurada)" : "Demostración (ALTERESTATE_PUBLIC_TOKEN vacío)"} ok={catalogMode() === "live"} />
            <Row k="Última sincronización completa" v={cs.fetchedAt ? `${fmtDate(cs.fetchedAt)} · ${cs.inventoryCount} propiedades` : "—"} />
            <Row k="Último error" v={cs.error ?? "—"} ok={!cs.error} />
            <Row k="Caché" v={`${env.alterestate.cacheSeconds} s (datos antiguos tolerados ${Math.round(env.alterestate.maxStaleSeconds / 3600)} h si AlterEstate falla)`} />
          </dl>
        </Card>
        <Card title="Asistente IA">
          <dl>
            <Row k="Estado" v={ai.ok ? "Activo" : ai.reason === "not_configured" ? `Sin clave ${env.ai.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} (modo contacto directo)` : "Desactivado"} ok={ai.ok} />
            <Row k="Proveedor" v={env.ai.provider === "openai" ? "OpenAI" : "Anthropic (Claude)"} />
            <Row k="Modelo / esfuerzo" v={`${env.ai.model} · ${env.ai.effort}`} />
            <Row k="Base de conocimiento" v={`Documento del ${KNOWLEDGE_VERSION}`} />
            <Row k="Presupuesto mensual" v={`US$${usage.monthCostUsd.toFixed(2)} / US$${usage.budgetUsd}`} ok={usage.monthCostUsd < usage.budgetUsd} />
            <Row k="Límites" v={`${env.ai.maxTurnsPerSession} mensajes/conversación · ${env.ai.dailyMessageLimit}/día · ${env.ai.perIpPer10Min}/10 min por IP`} />
          </dl>
        </Card>
        <Card title="CRM y datos">
          <dl>
            <Row k="Base de datos" v={env.database.url ? "PostgreSQL (DATABASE_URL)" : "PGlite local (solo vista previa)"} ok={crmStorageConfigured()} />
            <Row k="Conservación de conversaciones" v={`${env.crm.chatRetentionDays} días`} />
            <Row k="Prospectos inactivos" v={env.crm.inactiveContactRetentionMonths ? `Eliminados tras ${env.crm.inactiveContactRetentionMonths} meses` : "Sin eliminación automática"} />
            <Row k="Umbral de prioridad" v={`US$${env.crm.priorityBudgetUsd.toLocaleString("en-US")}${env.crm.usdDopRate ? ` · tasa DOP ${env.crm.usdDopRate}` : " · presupuestos en DOP no convertidos"}`} />
            <Row k="Niveles" v={`Caliente ≥ ${QUALIFICATION.hotMin} pts · Tibio ≥ ${QUALIFICATION.warmMin} pts`} />
            <Row k="Etapas" v={PIPELINE.map((p) => p.label).join(" → ")} />
            <Row k="Tarea de mantenimiento" v={env.cronSecret ? "CRON_SECRET configurado" : "CRON_SECRET vacío: purga automática desactivada"} ok={Boolean(env.cronSecret)} />
          </dl>
        </Card>
        <Card title="Notificaciones y calendario">
          <dl>
            <Row k="Modo" v={env.notify.mode === "live" ? "Envío real" : "Prueba"} ok={env.notify.mode === "live"} />
            <Row k="Correo" v={env.notify.resendApiKey && env.notify.emailFrom ? "Resend configurado" : "Resend no configurado"} ok={Boolean(env.notify.resendApiKey && env.notify.emailFrom)} />
            <Row k="Destinatarios" v={env.notify.emailTo.length ? env.notify.emailTo.join(", ") : "—"} ok={env.notify.emailTo.length > 0} />
            <Row k="WhatsApp automático" v={env.notify.whatsapp.enabled ? "Activado (WhatsApp Cloud API)" : "Desactivado: solo enlaces wa.me"} ok={env.notify.whatsapp.enabled} />
            <Row k="Calendario" v={getCalendar().connected ? getCalendar().name : "Ninguno: visitas pendientes de confirmación manual"} ok={getCalendar().connected} />
          </dl>
        </Card>
      </div>
    </div>
  );
}
