import type { Metadata } from "next";
import { isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { site } from "@/config/site";
import { env } from "@/config/env";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/site/PageHero";

type Props = { params: Promise<{ lang: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  return pageMetadata({ lang, route: "privacy", title: getDict(lang).privacy.title, description: lang === "es" ? "Cómo usamos los datos que nos envías." : "How we use the information you send us." });
}

export default async function Privacy({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : "es";
  const t = getDict(lang);
  const days = env.crm.chatRetentionDays;
  const months = env.crm.inactiveContactRetentionMonths;
  const es = lang === "es";
  const aiVendor = env.ai.provider === "openai" ? "OpenAI" : "Anthropic";
  const sections: { h: string; p: string[] }[] = es
    ? [
        { h: "Responsable", p: [`${site.name} (${site.legalName}), ${site.address.street.es}, ${site.address.locality}, ${site.address.region}, República Dominicana. Contacto: ${site.email}.`] },
        { h: "Qué datos recogemos", p: ["Solo los que nos envías: nombre, correo y/o teléfono, país, el mensaje y los criterios de tu búsqueda o de la propiedad que quieres vender, y, si pides una visita, las fechas que propones.", "No pedimos documentos de identidad, datos bancarios ni contraseñas a través del sitio."] },
        { h: "Para qué los usamos", p: ["Para responder a tu solicitud, organizar el seguimiento comercial y, si lo pides, coordinar una visita. No vendemos tus datos ni los usamos para otros fines."] },
        { h: "Asistente con inteligencia artificial", p: [`El asistente del sitio funciona con un modelo de inteligencia artificial de ${aiVendor}. Los mensajes que escribes se envían a ese proveedor para generar las respuestas. El asistente puede equivocarse: los precios y la disponibilidad los confirma Elvyn.`, "Tus datos de contacto solo se envían a la agencia cuando pulsas el botón «Enviar a Elvyn»."] },
        { h: "Conservación", p: [`Las conversaciones con el asistente se eliminan a los ${days} días. Los datos de los prospectos se conservan mientras dure la relación comercial y se eliminan tras ${months} meses sin actividad, salvo obligación legal.`] },
        { h: "Tus derechos", p: [`Puedes pedir acceso, rectificación, una copia (exportación) o la eliminación de tus datos escribiendo a ${site.email}.`] },
        { h: "Cookies", p: ["El sitio usa únicamente cookies técnicas: una para mantener tu conversación con el asistente y otra para el acceso privado de la agencia. No usamos cookies publicitarias ni de análisis."] },
        { h: "Proveedores", p: [`Catálogo de propiedades: AlterEstate. Asistente: ${aiVendor}. Alojamiento, base de datos y envío de correos: proveedores técnicos indicados por la agencia en la puesta en producción.`] },
      ]
    : [
        { h: "Controller", p: [`${site.name} (${site.legalName}), ${site.address.street.en}, ${site.address.locality}, ${site.address.region}, Dominican Republic. Contact: ${site.email}.`] },
        { h: "What we collect", p: ["Only what you send us: name, email and/or phone, country, your message and the criteria of your search or of the property you want to sell, and, if you request a visit, the dates you propose.", "We never ask for ID documents, bank details or passwords on this website."] },
        { h: "Why we use it", p: ["To answer your request, organise the follow-up and, if you ask, arrange a visit. We do not sell your data or use it for other purposes."] },
        { h: "AI assistant", p: [`The website assistant runs on an artificial intelligence model from ${aiVendor}. The messages you type are sent to that provider to generate the replies. The assistant can make mistakes: Elvyn confirms prices and availability.`, "Your contact details are only sent to the agency when you press “Send to Elvyn”."] },
        { h: "Retention", p: [`Assistant conversations are deleted after ${days} days. Prospect data is kept for the duration of the business relationship and deleted after ${months} months without activity, unless the law requires otherwise.`] },
        { h: "Your rights", p: [`You can request access, correction, a copy (export) or deletion of your data by writing to ${site.email}.`] },
        { h: "Cookies", p: ["The website only uses technical cookies: one to keep your conversation with the assistant and one for the agency's private area. We do not use advertising or analytics cookies."] },
        { h: "Providers", p: [`Property catalogue: AlterEstate. Assistant: ${aiVendor}. Hosting, database and email delivery: technical providers named by the agency when the site goes live.`] },
      ];
  return (
    <>
      <PageHero title={t.privacy.title} subtitle={t.privacy.updated} />
      <article className="container max-w-3xl py-14">
        <p className="rounded-xl bg-navy-50 p-4 text-sm text-ink-muted">
          {es ? "Este texto describe cómo funciona este sitio. No sustituye una revisión jurídica." : "This text describes how this website works. It does not replace a legal review."}
        </p>
        {sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="font-display text-2xl font-semibold">{s.h}</h2>
            {s.p.map((p) => <p key={p.slice(0, 30)} className="mt-3 leading-relaxed text-ink">{p}</p>)}
          </section>
        ))}
      </article>
    </>
  );
}
