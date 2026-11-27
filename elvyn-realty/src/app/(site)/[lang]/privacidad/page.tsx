import type { Metadata } from "next";
import { isLang, type Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
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
  const es = lang === "es";
  // Text provided by Elvyn Arnaud (knowledge base of 26/11/2026, section 12), published at his request on 27/11/2026.
  const sections: { h: string; p: string }[] = es
    ? [
        { h: "1. Responsable", p: "DRSPACE Finders EIRL, nombre comercial Elvyn Arnaud Realty, RNC 1-32-73387-8, con domicilio en Carretera Cabrera a Río San Juan, Plaza DF-060, Local 15, Segundo Piso, Cabrera, MTS 33100, República Dominicana. Contacto: elvyn@drspacefinders.com, +1 (809) 710-5384." },
        { h: "2. Marco legal", p: "Tratamos los datos conforme a la Constitución de la República Dominicana (derecho a la intimidad y acción de hábeas data), la Ley 172-13 sobre Protección de Datos de Carácter Personal y la Ley 155-17 contra el Lavado de Activos, que obliga a los agentes inmobiliarios a identificar a sus clientes en determinadas operaciones." },
        { h: "3. Datos que recopilamos", p: "Identificación y contacto (nombre, teléfono o WhatsApp, correo, país y ciudad, idioma); preferencias inmobiliarias (tipo, zona, tamaño, uso, plazo); información financiera general (presupuesto y forma de pago, nunca números de cuentas ni tarjetas); el contenido de las conversaciones; si es propietario, ubicación, características, fotos y situación legal del inmueble. Solo al avanzar a reserva o contrato, y directamente con Elvyn Arnaud: documento de identidad, estado civil, domicilio y, cuando la ley lo exija, origen de los fondos." },
        { h: "4. Cómo los obtenemos", p: "Directamente de usted por WhatsApp, sitio web, redes sociales, formularios, llamadas, correo, visitas y eventos, o por referencia de un tercero que usted autorizó." },
        { h: "5. Para qué los usamos", p: "Responder consultas y enviar opciones; agendar llamadas, videollamadas y visitas; dar seguimiento comercial; preparar ofertas, hojas de reserva, recibos y contratos; cumplir obligaciones legales, incluida la debida diligencia de la Ley 155-17; y, solo con su consentimiento separado, enviar novedades y promociones." },
        { h: "6. Base para tratarlos", p: "Su consentimiento, las gestiones previas a un contrato que usted solicita, la ejecución del contrato y el cumplimiento de obligaciones legales." },
        { h: "7. Con quién los compartimos", p: "No vendemos ni alquilamos sus datos. Solo los compartimos, en la medida necesaria, con el propietario o desarrollador del inmueble que le interesa; abogados, notarios, agrimensores y tasadores de la operación; entidades financieras si solicita financiamiento; proveedores tecnológicos (mensajería, correo, gestión de clientes y asistente de inteligencia artificial); y autoridades cuando la ley lo exija." },
        { h: "8. Transferencia internacional", p: "Algunos proveedores tecnológicos (por ejemplo, WhatsApp o servicios en la nube) pueden almacenar datos fuera de la República Dominicana. Elegimos proveedores con medidas de seguridad reconocidas." },
        { h: "9. Conservación", p: "Clientes potenciales sin operación: hasta 24 meses desde el último contacto; luego se eliminan o anonimizan. Clientes con operación: el plazo que exija la ley; la Ley 155-17 exige conservar los registros de debida diligencia al menos 10 años." },
        { h: "10. Sus derechos", p: "Puede pedir en cualquier momento acceder a sus datos, corregirlos, eliminarlos, oponerse a su uso o retirar su consentimiento, escribiendo a elvyn@drspacefinders.com o al WhatsApp +1 (809) 710-5384. Respondemos en un máximo de 10 días hábiles. También puede ejercer la acción de hábeas data ante los tribunales." },
        { h: "11. Comunicaciones comerciales", p: "Solo enviamos promociones si usted lo acepta. Puede darse de baja en cualquier momento respondiendo \"BAJA\"." },
        { h: "12. Seguridad y aviso antifraude", p: "Limitamos el acceso a sus datos a quienes los necesitan, usamos cuentas protegidas y nunca pedimos datos bancarios, contraseñas ni códigos por chat. Los pagos solo se hacen a las cuentas indicadas por escrito en el contrato o recibo oficial; ante cualquier duda, confirme llamando al +1 (809) 710-5384." },
        { h: "13. Uso de inteligencia artificial", p: "Parte de la atención inicial la realiza un asistente virtual automatizado. Las decisiones sobre precios, disponibilidad, reservas y contratos las toma siempre una persona. Elvyn Arnaud puede revisar las conversaciones para darle seguimiento." },
        { h: "14. Menores de edad", p: "Nuestros servicios están dirigidos a mayores de 18 años. No recopilamos datos de menores de forma intencional." },
        { h: "15. Cambios", p: "Podemos actualizar esta política. La versión vigente estará publicada en elvynarnaudrealty.com con su fecha de actualización." },
      ]
    : [
        { h: "1. Controller", p: "DRSPACE Finders EIRL, trading as Elvyn Arnaud Realty, RNC 1-32-73387-8, registered at Carretera Cabrera a Río San Juan, Plaza DF-060, Local 15, Second Floor, Cabrera, MTS 33100, Dominican Republic. Contact: elvyn@drspacefinders.com, +1 (809) 710-5384." },
        { h: "2. Legal framework", p: "We process data in accordance with the Constitution of the Dominican Republic (right to privacy and habeas data action), Law 172-13 on the Protection of Personal Data and Law 155-17 against Money Laundering, which requires real estate agents to identify their clients in certain transactions." },
        { h: "3. Data we collect", p: "Identification and contact details (name, phone or WhatsApp, email, country and city, language); property preferences (type, area, size, use, timeline); general financial information (budget and payment method, never account or card numbers); the content of conversations; if you are an owner, the location, features, photos and legal status of the property. Only when moving forward to a reservation or contract, and directly with Elvyn Arnaud: identity document, marital status, address and, when the law requires it, the source of funds." },
        { h: "4. How we obtain it", p: "Directly from you via WhatsApp, the website, social media, forms, calls, email, visits and events, or through a referral from a third party you authorised." },
        { h: "5. What we use it for", p: "Answering questions and sending options; scheduling calls, video calls and visits; commercial follow-up; preparing offers, reservation forms, receipts and contracts; meeting legal obligations, including the due diligence required by Law 155-17; and, only with your separate consent, sending news and promotions." },
        { h: "6. Legal basis", p: "Your consent, the pre-contractual steps you request, the performance of the contract and compliance with legal obligations." },
        { h: "7. Who we share it with", p: "We do not sell or rent your data. We only share it, as far as necessary, with the owner or developer of the property you are interested in; the lawyers, notaries, surveyors and appraisers involved in the transaction; financial institutions if you apply for financing; technology providers (messaging, email, client management and artificial intelligence assistant); and authorities when the law requires it." },
        { h: "8. International transfers", p: "Some technology providers (for example WhatsApp or cloud services) may store data outside the Dominican Republic. We choose providers with recognised security measures." },
        { h: "9. Retention", p: "Prospective clients without a transaction: up to 24 months from the last contact; the data is then deleted or anonymised. Clients with a transaction: the period required by law; Law 155-17 requires due diligence records to be kept for at least 10 years." },
        { h: "10. Your rights", p: "You can ask at any time to access, correct or delete your data, object to its use or withdraw your consent by writing to elvyn@drspacefinders.com or via WhatsApp at +1 (809) 710-5384. We reply within 10 business days at most. You may also bring a habeas data action before the courts." },
        { h: "11. Marketing communications", p: "We only send promotions if you agree. You can unsubscribe at any time by replying \"BAJA\" (unsubscribe)." },
        { h: "12. Security and anti-fraud notice", p: "We limit access to your data to those who need it, use protected accounts and never ask for bank details, passwords or codes by chat. Payments are only made to the accounts stated in writing in the contract or official receipt; if in doubt, confirm by calling +1 (809) 710-5384." },
        { h: "13. Use of artificial intelligence", p: "Part of the initial service is provided by an automated virtual assistant. Decisions on prices, availability, reservations and contracts are always made by a person. Elvyn Arnaud may review conversations to follow up with you." },
        { h: "14. Minors", p: "Our services are intended for people over 18. We do not knowingly collect data from minors." },
        { h: "15. Changes", p: "We may update this policy. The current version will be published on elvynarnaudrealty.com with its update date." },
      ];
  return (
    <>
      <PageHero title={t.privacy.title} subtitle={t.privacy.updated} />
      <article className="container max-w-3xl py-14">
        <h2 className="font-display text-2xl font-semibold">{es ? "Política de Privacidad y Tratamiento de Datos Personales" : "Privacy and Personal Data Policy"}</h2>
        {!es && <p className="mt-3 text-sm text-ink-muted">English translation for information; the Spanish version prevails.</p>}
        {sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h3 className="font-display text-xl font-semibold">{s.h}</h3>
            <p className="mt-3 leading-relaxed text-ink">{s.p}</p>
          </section>
        ))}
      </article>
    </>
  );
}
