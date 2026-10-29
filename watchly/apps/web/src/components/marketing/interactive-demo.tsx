"use client";
/**
 * Démonstration interactive publique — 100 % locale et FICTIVE.
 * Aucun appel réseau, aucune API payante : les scénarios rejouent des données inventées
 * selon les mêmes règles que les moteurs réels (seuil de prix, exigence de source officielle,
 * confirmation d'une panne avant alerte).
 */
import { useEffect, useMemo, useState } from "react";
import { BellRing, CircleCheck, Pause, Play, RotateCcw, ServerCrash, TrendingDown, Newspaper } from "lucide-react";
import {
  AnimatePresence,
  Badge,
  Button,
  Container,
  Label,
  SectionHeading,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  motion,
  useReducedMotion,
} from "@watchly/ui";
import { formatPrice } from "@watchly/types";

type Scenario = "price" | "announcement" | "outage";

interface Step {
  time: string;
  title: string;
  detail: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
  alert: boolean;
}

/* --------------------------------------------------------------------------- Prix */
const PRICE_SERIES = [
  { time: "Lun. 08:00", price: 899 },
  { time: "Lun. 14:00", price: 899 },
  { time: "Lun. 20:00", price: 879 },
  { time: "Mar. 02:00", price: 879 },
  { time: "Mar. 08:00", price: 789 },
  { time: "Mar. 14:00", price: 819 },
];

function priceSteps(threshold: number): Step[] {
  let alerted = false;
  return PRICE_SERIES.map((p, i) => {
    const prev = PRICE_SERIES[i - 1]?.price;
    const below = p.price < threshold;
    const alert = below && !alerted;
    if (below) alerted = true;
    if (!below) alerted = false;
    return {
      time: p.time,
      title: `${formatPrice(p.price)}${prev !== undefined && prev !== p.price ? ` (${p.price < prev ? "−" : "+"}${formatPrice(Math.abs(p.price - prev))})` : ""}`,
      detail: alert
        ? `Sous votre seuil de ${formatPrice(threshold)} : alerte envoyée.`
        : below
          ? "Toujours sous le seuil : pas de nouvelle alerte (évite les répétitions)."
          : prev !== undefined && p.price < prev
            ? "Baisse détectée, mais au-dessus du seuil : pas d'alerte."
            : "Aucun changement utile.",
      tone: alert ? "success" : below ? "info" : "neutral",
      alert,
    };
  });
}

/* ------------------------------------------------------------------ Annonce officielle */
const ANNOUNCEMENT_FINDINGS = [
  { time: "Jour 1", source: "forum-jeux.example", kind: "rumor" as const, text: "« Sortie prévue en mars selon un testeur »" },
  { time: "Jour 3", source: "media-specialise.example", kind: "probable" as const, text: "Un média évoque une sortie au printemps, sans confirmation." },
  { time: "Jour 4", source: "media-specialise.example", kind: "duplicate" as const, text: "Même information republiée : ignorée (doublon)." },
  { time: "Jour 6", source: "editeur-officiel.example", kind: "confirmed" as const, text: "Communiqué de l'éditeur : sortie le 14 mars." },
];

function announcementSteps(officialOnly: boolean): Step[] {
  return ANNOUNCEMENT_FINDINGS.map((f) => {
    const alert = f.kind === "confirmed" || (!officialOnly && f.kind === "probable");
    const label =
      f.kind === "rumor" ? "Rumeur" : f.kind === "probable" ? "Information probable" : f.kind === "confirmed" ? "Information confirmée" : "Doublon";
    return {
      time: f.time,
      title: `${label} — ${f.source}`,
      detail: `${f.text} ${
        alert
          ? "→ Alerte envoyée avec la source."
          : f.kind === "duplicate"
            ? ""
            : officialOnly
              ? "→ Pas d'alerte : vous avez demandé une annonce officielle."
              : "→ Pas d'alerte : une rumeur n'est jamais présentée comme un fait."
      }`,
      tone: f.kind === "confirmed" ? "success" : f.kind === "probable" ? "info" : f.kind === "rumor" ? "warning" : "neutral",
      alert,
    };
  });
}

/* ------------------------------------------------------------------------------ Panne */
const OUTAGE_CHECKS: Array<{ time: string; ok: boolean; detail: string; confirm?: boolean }> = [
  { time: "13:46", ok: true, detail: "200 · 176 ms" },
  { time: "13:47", ok: false, detail: "Délai dépassé (micro-coupure)" },
  { time: "13:47:30", ok: true, detail: "200 · 190 ms", confirm: true },
  { time: "13:48", ok: true, detail: "200 · 171 ms" },
  { time: "14:02", ok: false, detail: "503 Service Unavailable" },
  { time: "14:02:30", ok: false, detail: "503 Service Unavailable", confirm: true },
  { time: "14:03", ok: false, detail: "503 Service Unavailable" },
  { time: "14:19", ok: true, detail: "200 · 182 ms" },
];

function outageSteps(confirmation: boolean): Step[] {
  const steps: Step[] = [];
  let open = false;
  for (const c of OUTAGE_CHECKS) {
    if (c.confirm && !confirmation) continue;
    if (c.confirm) {
      if (c.ok) {
        steps.push({ time: c.time, title: "Fausse alerte évitée", detail: `Seconde vérification : ${c.detail}. Aucune alerte envoyée.`, tone: "info", alert: false });
      } else {
        open = true;
        steps.push({ time: c.time, title: "Panne confirmée", detail: `Seconde vérification : ${c.detail}. Incident ouvert, alerte prioritaire envoyée.`, tone: "danger", alert: true });
      }
      continue;
    }
    if (c.ok) {
      if (open) {
        open = false;
        steps.push({ time: c.time, title: "Service rétabli", detail: `${c.detail}. Alerte de rétablissement envoyée.`, tone: "success", alert: true });
      } else {
        steps.push({ time: c.time, title: "Opérationnel", detail: c.detail, tone: "neutral", alert: false });
      }
      continue;
    }
    if (open) {
      steps.push({ time: c.time, title: "Toujours en panne", detail: `${c.detail}. Pas de nouvelle alerte.`, tone: "danger", alert: false });
      continue;
    }
    if (confirmation) {
      steps.push({ time: c.time, title: "Échec détecté", detail: `${c.detail}. Seconde vérification dans 30 s avant d'alerter.`, tone: "warning", alert: false });
    } else {
      open = true;
      steps.push({ time: c.time, title: "Panne signalée", detail: `${c.detail}. Alerte immédiate, sans confirmation.`, tone: "danger", alert: true });
    }
  }
  return steps;
}

const toneDot: Record<Step["tone"], string> = {
  neutral: "bg-line-strong",
  info: "bg-blue",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

export function InteractiveDemo() {
  const [scenario, setScenario] = useState<Scenario>("price");
  const [threshold, setThreshold] = useState(800);
  const [officialOnly, setOfficialOnly] = useState(true);
  const [confirmation, setConfirmation] = useState(true);
  const [visible, setVisible] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();

  const steps = useMemo(() => {
    if (scenario === "price") return priceSteps(threshold);
    if (scenario === "announcement") return announcementSteps(officialOnly);
    return outageSteps(confirmation);
  }, [scenario, threshold, officialOnly, confirmation]);

  useEffect(() => {
    setVisible(0);
    setPlaying(false);
  }, [scenario, threshold, officialOnly, confirmation]);

  useEffect(() => {
    if (!playing) return;
    if (visible >= steps.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setVisible((v) => v + 1), reduce ? 50 : 900);
    return () => window.clearTimeout(id);
  }, [playing, visible, steps.length, reduce]);

  const shown = steps.slice(0, visible);
  const alerts = shown.filter((s) => s.alert).length;
  const done = visible >= steps.length;

  return (
    <section id="demo" aria-labelledby="demo-title" className="border-y border-line bg-surface py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="demo-title"
          eyebrow="Démonstration interactive"
          title="Voyez Watchly décider à votre place"
          description="Choisissez un scénario, ajustez la règle et lancez la simulation. Les données sont entièrement fictives et la démonstration ne contacte aucun site."
        />
        <Tabs value={scenario} onValueChange={(v) => setScenario(v as Scenario)} className="mt-12 flex flex-col items-center gap-8">
          <TabsList aria-label="Scénario de démonstration" className="flex-wrap justify-center">
            <TabsTrigger value="price">
              <TrendingDown aria-hidden="true" /> Surveillance de prix
            </TabsTrigger>
            <TabsTrigger value="announcement">
              <Newspaper aria-hidden="true" /> Annonce officielle
            </TabsTrigger>
            <TabsTrigger value="outage">
              <ServerCrash aria-hidden="true" /> Panne de site pro
            </TabsTrigger>
          </TabsList>

          {(["price", "announcement", "outage"] as const).map((s) => (
            <TabsContent key={s} value={s} className="w-full focus-visible:outline-none">
              <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[320px_1fr]">
                <div className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
                  <Badge tone="outline" className="w-fit">
                    Données fictives
                  </Badge>
                  {s === "price" ? (
                    <>
                      <div>
                        <p className="font-display font-semibold">Ordinateur portable 15″</p>
                        <p className="text-sm text-muted-fg">boutique-exemple.fr · contrôle toutes les 6 h</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="demo-threshold">
                          M'alerter sous <span className="tabular-nums">{formatPrice(threshold)}</span>
                        </Label>
                        <input
                          id="demo-threshold"
                          type="range"
                          min={700}
                          max={950}
                          step={10}
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                          className="w-full accent-blue"
                        />
                      </div>
                    </>
                  ) : s === "announcement" ? (
                    <>
                      <div>
                        <p className="font-display font-semibold">« Projet Aurora »</p>
                        <p className="text-sm text-muted-fg">Date de sortie · recherche quotidienne</p>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="demo-official">Seulement si c'est officiel</Label>
                        <Switch id="demo-official" checked={officialOnly} onCheckedChange={setOfficialOnly} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-display font-semibold">boutique-exemple.fr</p>
                        <p className="text-sm text-muted-fg">Page d'accueil · contrôle chaque minute</p>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="demo-confirm">Confirmer avant d'alerter</Label>
                        <Switch id="demo-confirm" checked={confirmation} onCheckedChange={setConfirmation} />
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (done) setVisible(0);
                        setPlaying((p) => !p || done);
                      }}
                      className="flex-1"
                    >
                      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                      {playing ? "Pause" : done ? "Rejouer" : visible ? "Reprendre" : "Lancer la simulation"}
                    </Button>
                    <Button variant="secondary" size="icon" aria-label="Réinitialiser" onClick={() => { setVisible(0); setPlaying(false); }}>
                      <RotateCcw aria-hidden="true" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" disabled={done} onClick={() => setVisible((v) => Math.min(steps.length, v + 1))}>
                    Étape suivante
                  </Button>
                </div>

                <div className="flex min-h-[380px] flex-col rounded-2xl border border-line bg-white p-6">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold">Journal des contrôles</p>
                    <span aria-live="polite" className="inline-flex items-center gap-1.5 text-sm text-muted-fg">
                      <BellRing className="size-4" aria-hidden="true" /> {alerts} alerte{alerts > 1 ? "s" : ""}
                    </span>
                  </div>
                  {shown.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-fg">
                      <Play className="size-5" aria-hidden="true" />
                      Lancez la simulation pour voir les contrôles défiler.
                    </div>
                  ) : (
                    <ol className="mt-5 flex flex-col gap-3" aria-live="polite">
                      <AnimatePresence initial={false}>
                        {shown.map((st, i) => (
                          <motion.li
                            key={`${s}-${i}-${st.time}`}
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                            className={cn(
                              "flex gap-3 rounded-xl border p-3.5",
                              st.alert ? "border-gradient" : "border-line",
                            )}
                          >
                            <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[st.tone])} />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium">{st.title}</span>
                                <time className="text-xs tabular-nums text-muted-fg">{st.time}</time>
                              </div>
                              <p className="text-sm text-muted-fg">{st.detail}</p>
                            </div>
                            {st.alert ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-violet" aria-label="Alerte envoyée" /> : null}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Container>
    </section>
  );
}
