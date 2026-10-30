import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Cloud,
  Cpu,
  FileDiff,
  FormInput,
  Gauge,
  Globe,
  Laptop,
  MessageSquareText,
  MousePointerClick,
  Newspaper,
  PackageCheck,
  Radar,
  ShieldCheck,
  Siren,
  Tag,
  Wifi,
  FileText,
  Briefcase,
  CalendarClock,
  Landmark,
  Search,
} from "lucide-react";
import { Badge, Button, Card, Container, Reveal, SectionHeading, UptimeBars } from "@waverti/ui";
import { IncidentList } from "@waverti/ui/app";
import { DEMO_NOW, demoIncidents } from "@/lib/demo-data";
import { BrowserFrame } from "./browser-frame";

/* -------------------------------------------------------------- 3. Comment ça marche */
const steps = [
  {
    icon: <MessageSquareText />,
    title: "Dites à Waverti ce que vous recherchez",
    text: "Collez l'adresse d'une page ou décrivez votre demande : un prix à surveiller, un produit en rupture, une annonce attendue.",
  },
  {
    icon: <Radar />,
    title: "Waverti vérifie automatiquement",
    text: "Les contrôles s'exécutent à la fréquence de votre formule, sur votre ordinateur ou sur nos serveurs selon la disponibilité.",
  },
  {
    icon: <BellRing />,
    title: "Vous êtes prévenu au bon moment",
    text: "Une notification arrive seulement quand votre condition est remplie, avec la source et l'heure de détection.",
  },
];

export function HowItWorks() {
  return (
    <section id="comment-ca-marche" aria-labelledby="how-title" className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow="Comment ça marche"
          title="Trois étapes, puis vous n'y pensez plus"
          description="Waverti répète les vérifications à votre place et ne vous dérange que lorsqu'il se passe quelque chose."
        />
        <ol className="mt-16 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 0.08}>
              <Card interactive className="relative h-full p-7">
                <span className="font-display text-sm font-bold text-muted-fg">0{i + 1}</span>
                <span className="mt-5 grid size-12 place-items-center rounded-2xl border border-line bg-surface text-ink [&_svg]:size-5">
                  {s.icon}
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-fg">{s.text}</p>
              </Card>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- 4. Surveillance d'un site */
const pageExamples = [
  { icon: <Tag />, title: "Un ordinateur dont le prix descend sous 800 €", tag: "Prix" },
  { icon: <PackageCheck />, title: "Un produit de nouveau en stock", tag: "Stock" },
  { icon: <FileDiff />, title: "La modification d'une page", tag: "Changement" },
  { icon: <Newspaper />, title: "Une nouvelle annonce publiée", tag: "Annonce" },
];

export function PageMonitoring() {
  return (
    <section id="fonctionnalites" aria-labelledby="page-title" className="border-y border-line bg-surface py-24 sm:py-32">
      <Container className="grid items-center gap-14 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="page-title"
            align="left"
            eyebrow="Surveillance d'un site précis"
            title="Une page, une condition, une alerte"
            description="Waverti lit la page comme vous le feriez : le prix affiché, la disponibilité, le texte. Il compare avec le contrôle précédent et ne vous alerte que si votre condition est satisfaite."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {pageExamples.map((e, i) => (
              <Reveal as="li" key={e.title} delay={i * 0.06}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-line bg-white p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-ink-soft [&_svg]:size-4">{e.icon}</span>
                  <span className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-[0.06em] text-muted-fg">{e.tag}</span>
                    <span className="text-[15px] font-medium leading-snug">{e.title}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
          <p className="text-sm text-muted-fg">
            Waverti utilise une simple requête HTTP lorsque c'est possible, et un navigateur automatisé uniquement quand la
            page l'exige. Les pages protégées par un compte ou interdites aux robots ne sont pas consultées.
          </p>
        </div>
        <Reveal>
          <PriceDemoCard />
        </Reveal>
      </Container>
    </section>
  );
}

function PriceDemoCard() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-6 rounded-[36px] bg-waverti-gradient opacity-[0.08] blur-2xl" />
      <div className="relative rounded-2xl border border-line bg-white p-6 shadow-lift sm:p-8">
        <div className="flex items-center justify-between">
          <Badge tone="outline">Exemple fictif</Badge>
          <span className="text-xs text-muted-fg">Contrôle de 09:00</span>
        </div>
        <p className="mt-6 text-sm text-muted-fg">boutique-exemple.fr</p>
        <p className="mt-1 font-display text-2xl font-bold tracking-tight">Ordinateur portable 15″</p>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-muted-fg">Contrôle précédent</p>
            <p className="mt-2 font-display text-2xl font-semibold text-muted-fg line-through decoration-2">899,00 €</p>
          </div>
          <div className="relative rounded-xl p-4 border-gradient">
            <p className="text-xs text-muted-fg">Nouveau prix</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">789,00 €</p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-success-soft px-4 py-3 text-sm text-ink">
          <BellRing className="size-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            <strong>Condition remplie :</strong> prix sous votre seuil de 800 €. Alerte envoyée.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 5. Recherche Internet */
const webExamples = [
  { icon: <CalendarClock />, text: "La date de sortie officielle d'un jeu" },
  { icon: <Newspaper />, text: "L'annonce d'un nouveau produit" },
  { icon: <Briefcase />, text: "Une nouvelle offre de stage" },
  { icon: <Landmark />, text: "La publication d'une information officielle" },
];

const classification = [
  { tone: "success" as const, label: "Information confirmée", text: "Publiée par une source officielle ou une source de référence." },
  { tone: "info" as const, label: "Information probable", text: "Rapportée par des médias reconnus, sans confirmation officielle." },
  { tone: "warning" as const, label: "Rumeur", text: "Forums, réseaux sociaux, fuites : signalée comme telle, jamais présentée comme un fait." },
  { tone: "neutral" as const, label: "Aucune information trouvée", text: "Waverti ne comble jamais un manque d'information par une supposition." },
];

export function WebSearchSection() {
  return (
    <section aria-labelledby="web-title" className="py-24 sm:py-32">
      <Container className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="web-title"
            align="left"
            eyebrow="Recherche sur Internet"
            title="Posez votre question une fois, Waverti la repose chaque jour"
            description="Décrivez ce que vous attendez en langage courant. Waverti prépare des requêtes, interroge un moteur de recherche, examine les résultats accessibles et privilégie les sources officielles."
          />
          <ul className="flex flex-col gap-3">
            {webExamples.map((e) => (
              <li key={e.text} className="flex items-center gap-3 text-[15px]">
                <span className="grid size-9 place-items-center rounded-xl border border-line text-ink-soft [&_svg]:size-4">{e.icon}</span>
                {e.text}
              </li>
            ))}
          </ul>
          <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted-fg">
            <strong className="text-ink">Ce que Waverti ne fait pas :</strong> explorer l'intégralité d'Internet. Les recherches
            s'appuient sur un moteur de recherche et sur les pages publiques accessibles ; un contenu non indexé, réservé
            aux membres ou bloqué aux robots peut ne pas être trouvé.
          </p>
        </div>
        <Reveal>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <Search className="size-4 text-muted" aria-hidden="true" />
              <p className="text-[15px]">« Préviens-moi dès que la date de sortie officielle de ce jeu est annoncée. »</p>
            </div>
            <p className="mt-6 text-sm font-semibold">Chaque résultat est classé :</p>
            <ul className="mt-4 flex flex-col gap-3">
              {classification.map((c) => (
                <li key={c.label} className="flex flex-col gap-1.5 rounded-xl border border-line p-4 sm:flex-row sm:items-start sm:gap-4">
                  <Badge tone={c.tone} className="w-fit shrink-0">
                    {c.label}
                  </Badge>
                  <span className="text-sm text-muted-fg">{c.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted-fg">
              Si vous demandez une annonce <strong className="text-ink">officielle</strong>, l'alerte de confirmation n'est envoyée
              que lorsqu'une source suffisamment fiable la publie.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- 6. Waverti Business */
const businessFeatures = [
  { icon: <Gauge />, title: "Disponibilité 24h/24", text: "Vos pages clés vérifiées chaque minute depuis nos serveurs." },
  { icon: <Siren />, title: "Détection des erreurs", text: "Codes HTTP, délais de réponse, contenu attendu absent." },
  { icon: <FormInput />, title: "Tests de formulaires", text: "Remplissage et vérification sans envoi vers des tiers." },
  { icon: <MousePointerClick />, title: "Parcours utilisateurs", text: "Un scénario navigateur rejoué toutes les 2 heures." },
  { icon: <ShieldCheck />, title: "Certificat HTTPS", text: "Vérification quotidienne et alerte avant expiration." },
  { icon: <BellRing />, title: "Alertes rapides et confirmées", text: "Une panne est revérifiée avant de vous alerter." },
  { icon: <FileText />, title: "Rapports d'incidents", text: "Chronologie, durée, cause et capture en cas d'échec." },
  { icon: <Cloud />, title: "Indépendant de votre PC", text: "Les contrôles Business tournent toujours côté serveur." },
];

const demoUptime = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(DEMO_NOW.getTime() - (29 - i) * 86_400_000);
  const label = day.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" });
  const uptime = i === 29 ? 0.9882 : i === 17 ? 0.9965 : 1;
  return { day: label, uptime };
});

export function BusinessSection({ standalone = false }: { standalone?: boolean }) {
  return (
    <section id="entreprises" aria-labelledby="business-title" className="relative overflow-hidden bg-ink py-24 text-white sm:py-32">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-waverti-gradient opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-20 size-[520px] rounded-full bg-waverti-gradient opacity-[0.12] blur-[120px]"
      />
      <Container className="relative">
        <div className="flex flex-col items-start gap-5 lg:max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-white/80">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-waverti-gradient" />
            Waverti Business
          </span>
          {standalone ? (
            <h1 id="business-title" className="font-display text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">
              Votre site tombe en panne ? Vous le savez avant vos clients.
            </h1>
          ) : (
            <h2 id="business-title" className="font-display text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">
              Votre site tombe en panne ? Vous le savez avant vos clients.
            </h2>
          )}
          <p className="text-lg leading-relaxed text-white/75">
            Waverti Business contrôle la disponibilité de votre site professionnel, ses formulaires et ses parcours clés, et
            vous prévient dès qu'une panne est confirmée — puis quand tout est rétabli.
          </p>
        </div>
        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          <ul className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
            {businessFeatures.map((f) => (
              <li key={f.title} className="flex flex-col gap-2">
                <span className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white [&_svg]:size-[18px]">
                  {f.icon}
                </span>
                <h3 className="mt-1 font-display font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/70">{f.text}</p>
              </li>
            ))}
          </ul>
          <Reveal>
            <BrowserFrame label="app.waverti — Boutique exemple" caption="Données fictives de démonstration" className="text-ink">
              <div className="flex flex-col gap-5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-bold">Boutique exemple</p>
                    <p className="text-sm text-muted-fg">boutique-exemple.fr · 3 points de contrôle</p>
                  </div>
                  <Badge tone="success">Opérationnel</Badge>
                </div>
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="mb-3 text-sm font-medium">Disponibilité — 30 derniers jours</p>
                  <UptimeBars days={demoUptime} />
                </div>
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="mb-3 text-sm font-medium">Chronologie de la dernière panne</p>
                  <ol className="flex flex-col gap-2.5 text-sm">
                    {[
                      ["07:13:02", "HTTP 503 sur la page d'accueil", "danger"],
                      ["07:13:32", "Seconde vérification : échec confirmé", "danger"],
                      ["07:13:33", "Incident ouvert, alerte prioritaire envoyée", "warning"],
                      ["07:30:04", "Réponse 200 en 182 ms : service rétabli", "success"],
                    ].map(([t, label, tone]) => (
                      <li key={t} className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ${tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success"}`}
                        />
                        <time className="w-16 tabular-nums text-muted-fg">{t}</time>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <IncidentList incidents={demoIncidents} hrefFor={() => "#"} now={DEMO_NOW} />
              </div>
            </BrowserFrame>
          </Reveal>
        </div>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-white text-ink shadow-none hover:bg-white/90">
            <Link href="/entreprises">
              Découvrir Waverti Business <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
            <Link href="/tarifs#business">Voir le tarif Business</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------ 9. Fonctionnement hybride */
export function HybridSection() {
  return (
    <section aria-labelledby="hybrid-title" className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="hybrid-title"
          eyebrow="Fonctionnement hybride"
          title="Votre ordinateur d'abord, nos serveurs en relais"
          description="Avec l'application installée, vos surveillances personnelles peuvent s'exécuter directement sur votre ordinateur. S'il est éteint, nos serveurs prennent le relais pour les formules compatibles."
        />
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          <Card className="p-7">
            <span className="grid size-11 place-items-center rounded-2xl bg-surface [&_svg]:size-5">
              <Laptop />
            </span>
            <h3 className="mt-5 font-display text-lg font-semibold">Quand votre PC est allumé</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-fg">
              L'application reçoit uniquement vos propres surveillances, les vérifie et renvoie les résultats. Elle ne
              travaille jamais pour un autre utilisateur.
            </p>
          </Card>
          <Card className="p-7">
            <span className="grid size-11 place-items-center rounded-2xl bg-surface [&_svg]:size-5">
              <Cloud />
            </span>
            <h3 className="mt-5 font-display text-lg font-semibold">Quand il est indisponible</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-fg">
              Nos serveurs reprennent automatiquement vos contrôles, sans doublon : vos alertes continuent d'arriver.
            </p>
          </Card>
          <Card className="p-7">
            <span className="grid size-11 place-items-center rounded-2xl bg-surface [&_svg]:size-5">
              <Cpu />
            </span>
            <h3 className="mt-5 font-display text-lg font-semibold">Ressources utilisées</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-[15px] leading-relaxed text-muted-fg">
              <li>Processeur : brèves analyses de page, 2 contrôles simultanés au maximum.</li>
              <li>Mémoire : pages limitées à 2 Mo, aucune conservation du contenu complet.</li>
              <li className="flex gap-1">
                <Wifi className="mt-1 size-4 shrink-0" aria-hidden="true" /> Réseau : une page téléchargée par contrôle.
              </li>
            </ul>
          </Card>
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-fg">
          L'activité de l'application est toujours visible (icône et indicateur d'activité). Vous devez accepter
          explicitement ce fonctionnement local avant de l'activer, et vous pouvez fermer ou désinstaller Waverti à tout
          moment. Le démarrage automatique avec l'ordinateur est un choix séparé, désactivé par défaut.
        </p>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- 13. Appel à l'action */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px] border border-line bg-surface px-6 py-16 text-center sm:px-12 sm:py-24">
        <div aria-hidden="true" className="hairline-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-waverti-gradient" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <Globe className="size-8 text-ink-soft" aria-hidden="true" />
          <h2 id="cta-title" className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[52px]">
            Prêt à ne plus rien manquer ?
          </h2>
          <p className="text-lg text-muted-fg">Créez votre première surveillance en moins d'une minute.</p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" variant="gradient">
              <Link href="/tarifs">Essayer gratuitement pendant 3 jours</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="#tarifs">Voir les abonnements</Link>
            </Button>
          </div>
          <p className="text-[13px] text-muted-fg">
            3 jours d'essai gratuit sur Plus, Pro et Business. Carte bancaire requise pour l'essai, aucun prélèvement si vous
            résiliez avant la fin.
          </p>
        </div>
      </div>
    </section>
  );
}
