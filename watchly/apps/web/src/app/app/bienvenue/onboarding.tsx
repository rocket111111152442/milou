"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Cloud, Download, Globe, Laptop, PartyPopper, Search, ShieldCheck } from "lucide-react";
import { Button, Callout, Logo, Spinner, cn } from "@watchly/ui";
import { LOCAL_CONSENT_TEXT } from "@watchly/config/constants";
import { ResultTimeline, type FormEntitlements } from "@watchly/ui/app";
import type { ResultView } from "@watchly/types";
import { apiCall } from "@/components/app/use-api";
import { NewMonitor } from "../surveillances/nouvelle/new-monitor";

const STEPS = ["Bienvenue", "Présentation", "Application", "Fonctionnement local", "Première surveillance", "Résultat initial", "C'est parti"];

export function Onboarding({ displayName, hasDevice, entitlements }: { displayName: string | null; hasDevice: boolean; entitlements: FormEntitlements }) {
  const [step, setStep] = useState(0);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const router = useRouter();

  const finish = async () => {
    await apiCall("/api/account/profile", { method: "PATCH", body: { onboardingCompleted: true, onboardingStep: "done" } });
    router.push(monitorId ? `/app/surveillances/${monitorId}` : "/app");
    router.refresh();
  };
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-4">
      <div className="flex items-center justify-between">
        <Logo />
        <button type="button" onClick={finish} className="text-sm text-muted-fg underline-offset-4 hover:text-ink hover:underline">
          Passer l'introduction
        </button>
      </div>
      <ol className="flex gap-1.5" aria-label={`Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <li key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-watchly-gradient" : "bg-surface-strong")}>
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-line bg-white p-6 sm:p-10" aria-live="polite">
        {step === 0 ? (
          <div className="flex flex-col gap-5">
            <PartyPopper className="size-8 text-violet" aria-hidden="true" />
            <h1 className="font-display text-3xl font-bold tracking-tight">Bienvenue sur Watchly{displayName ? `, ${displayName}` : ""} !</h1>
            <p className="text-lg leading-relaxed text-muted-fg">En quelques étapes, vous allez créer votre première surveillance. Comptez moins de deux minutes.</p>
            <Button size="lg" onClick={next} className="self-start">
              Commencer <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-2xl font-bold">Ce que Watchly fait pour vous</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              <li className="rounded-xl border border-line p-4">
                <Globe className="size-5" aria-hidden="true" />
                <p className="mt-3 font-medium">Une page précise</p>
                <p className="mt-1 text-sm text-muted-fg">Un prix qui baisse, un produit de retour en stock, une page modifiée.</p>
              </li>
              <li className="rounded-xl border border-line p-4">
                <Search className="size-5" aria-hidden="true" />
                <p className="mt-3 font-medium">Un sujet sur Internet</p>
                <p className="mt-1 text-sm text-muted-fg">Une date de sortie, une annonce, une offre de stage (formules payantes).</p>
              </li>
            </ul>
            <Button onClick={next} className="self-start">
              Continuer
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-5">
            <Laptop className="size-7" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold">L'application pour votre ordinateur</h2>
            <p className="leading-relaxed text-muted-fg">
              L'application Watchly effectue vos contrôles depuis votre ordinateur et affiche des notifications sur votre bureau.
              {entitlements.cloudRelay
                ? " Avec votre formule, nos serveurs prennent le relais si elle n'est pas ouverte : elle est utile mais pas indispensable."
                : " Avec la formule Découverte, elle est nécessaire pour que vos surveillances s'exécutent."}
            </p>
            {hasDevice ? <Callout tone="success">Un appareil est déjà relié à votre compte.</Callout> : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href="/telecharger" target="_blank">
                  <Download aria-hidden="true" /> Voir les téléchargements
                </Link>
              </Button>
              <Button onClick={next}>Continuer sans installer</Button>
            </div>
            <p className="text-xs text-muted-fg">Pas d'ordinateur compatible ? Vous pouvez tout gérer depuis le navigateur.</p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-5">
            <ShieldCheck className="size-7" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold">Comment fonctionnent les contrôles locaux</h2>
            <blockquote className="rounded-xl border-l-4 border-blue bg-info-soft p-4 text-[15px] leading-relaxed">{LOCAL_CONSENT_TEXT}</blockquote>
            <ul className="flex flex-col gap-2 text-sm text-muted-fg">
              <li className="flex gap-2">
                <Laptop className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Votre ordinateur ne vérifie que VOS surveillances, jamais celles d'un autre utilisateur.
              </li>
              <li className="flex gap-2">
                <Cloud className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Vous accepterez ce fonctionnement dans l'application, au moment de l'activer. Vous pourrez le désactiver à tout moment.
              </li>
            </ul>
            <Button onClick={next} className="self-start">
              J'ai compris
            </Button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-2xl font-bold">Votre première surveillance</h2>
            <NewMonitor
              entitlements={entitlements}
              onCreated={(id) => {
                setMonitorId(id);
                next();
              }}
            />
          </div>
        ) : null}

        {step === 5 ? <InitialResult monitorId={monitorId} cloud={entitlements.cloudRelay} onNext={next} /> : null}

        {step === 6 ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-2xl font-bold">Tout est prêt</h2>
            <p className="leading-relaxed text-muted-fg">Watchly s'occupe des vérifications. Vous serez prévenu dès que votre condition sera remplie.</p>
            <Button size="lg" onClick={finish} className="self-start">
              Accéder au tableau de bord <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function InitialResult({ monitorId, cloud, onNext }: { monitorId: string | null; cloud: boolean; onNext: () => void }) {
  const [results, setResults] = useState<ResultView[] | null>(null);
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!monitorId) return;
    let stop = false;
    const tick = async () => {
      const r = await apiCall<{ results: ResultView[] }>(`/api/monitors/${monitorId}`, { method: "GET" });
      if (stop) return;
      if (r.ok && r.data.results.length) setResults(r.data.results);
      else if (waited < 20) setTimeout(() => setWaited((w) => w + 1), 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [monitorId, waited]);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-2xl font-bold">Résultat du premier contrôle</h2>
      {!monitorId ? (
        <p className="text-muted-fg">Aucune surveillance créée pour l'instant.</p>
      ) : results ? (
        <ResultTimeline results={results} />
      ) : waited >= 20 || !cloud ? (
        <Callout tone="info" title="Contrôle en attente">
          {cloud
            ? "Le premier contrôle prend plus de temps que prévu. Il apparaîtra dans le détail de la surveillance."
            : "Formule Découverte : le premier contrôle sera effectué par l'application Watchly dès qu'elle sera ouverte sur votre ordinateur."}
        </Callout>
      ) : (
        <p className="flex items-center gap-3 text-muted-fg" role="status">
          <Spinner /> Premier contrôle en cours…
        </p>
      )}
      <Button onClick={onNext} className="self-start">
        Continuer
      </Button>
    </div>
  );
}
