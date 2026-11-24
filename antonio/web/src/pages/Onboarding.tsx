import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AUTONOMY_LABELS, CATEGORIES, CATEGORY_LABELS, PROFESSION_PRESETS, type AutonomyLevel, type Category, type ProfessionPreset } from "@antonio/shared";
import { api, queryClient } from "../lib/api";
import { useMe } from "../lib/app-state";
import { Dictation, speakLocally } from "../voice/dictation";
import { Icon } from "../components/Icons";
import { ConnectButtons } from "./Settings";

type Profile = Record<string, unknown> & {
  firstName: string | null;
  assistantName: string;
  professionPreset: string;
  timezone: string;
  workDays: number[];
  workStart: string;
  workEnd: string;
  repetitiveTasks: string[];
  priorities: string[];
  tools: string[];
  tone: string;
  tutoiement: boolean;
  signature: string | null;
  priorityContacts: { email: string; name?: string }[];
  meetingPrefs: { defaultDurationMin: number; bufferMin: number; preferredMode: "visio" | "phone" | "in_person" };
  briefingTime: string;
  briefingContent: Record<string, boolean>;
  assistantVoice: string;
  company: string | null;
  jobRole: string | null;
  activity: string | null;
  language: string;
  onboardingStep: string | null;
};

interface Step {
  id: string;
  question: (p: Profile) => string;
  hint?: string;
  when?: (p: Profile) => boolean;
  render: (p: Profile, set: (patch: Partial<Profile>) => void, ctx: { preset: ProfessionPreset | undefined; presets: ProfessionPreset[]; voices: { id: string; label: string }[] }) => ReactElement;
  summary: (p: Profile) => string;
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function MultiChoice({ options, value, onChange, freeLabel }: { options: string[]; value: string[]; onChange: (v: string[]) => void; freeLabel: string }) {
  const [free, setFree] = useState("");
  const all = [...new Set([...options, ...value])];
  return (
    <div className="stack-12">
      <div className="chips">
        {all.map((o) => (
          <button type="button" key={o} className="chip" aria-pressed={value.includes(o)} onClick={() => onChange(toggle(value, o))}>
            {o}
          </button>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (free.trim()) onChange([...value, free.trim()]);
          setFree("");
        }}
      >
        <input className="input" value={free} onChange={(e) => setFree(e.target.value)} placeholder={freeLabel} aria-label={freeLabel} />
        <button className="btn" type="submit">
          Ajouter
        </button>
      </form>
    </div>
  );
}

const STEPS: Step[] = [
  {
    id: "first_name",
    question: () => "Bonjour ! Pour commencer, comment vous appelez-vous ?",
    render: (p, set) => <input className="input" autoFocus value={p.firstName ?? ""} onChange={(e) => set({ firstName: e.target.value })} aria-label="Prénom" />,
    summary: (p) => `Prénom : ${p.firstName ?? "—"}`,
  },
  {
    id: "assistant_name",
    question: (p) => `Enchanté${p.firstName ? `, ${p.firstName}` : ""}. Comment voulez-vous m'appeler ?`,
    hint: "Ce prénom sert aussi à m'appeler à la voix, si vous activez la veille.",
    render: (p, set) => <input className="input" value={p.assistantName} onChange={(e) => set({ assistantName: e.target.value })} aria-label="Prénom de l'assistant" />,
    summary: (p) => `Assistant : ${p.assistantName}`,
  },
  {
    id: "profession",
    question: () => "Quel est votre métier ? Je m'en sers comme point de départ, tout reste personnalisable.",
    hint: "Un profil métier ne promet pas d'intégration automatique à vos logiciels.",
    render: (p, set, { presets }) => (
      <div className="chips">
        {presets.map((pr) => (
          <button type="button" key={pr.id} className="chip" aria-pressed={p.professionPreset === pr.id} onClick={() => set({ professionPreset: pr.id })}>
            {pr.label}
          </button>
        ))}
      </div>
    ),
    summary: (p) => `Profil de départ : ${PROFESSION_PRESETS.find((x) => x.id === p.professionPreset)?.label ?? p.professionPreset}`,
  },
  {
    id: "company",
    question: () => "Pour quelle entreprise travaillez-vous, et quel est votre rôle ?",
    render: (p, set) => (
      <div className="grid-2">
        <div className="field">
          <label htmlFor="company">Entreprise</label>
          <input id="company" className="input" value={p.company ?? ""} onChange={(e) => set({ company: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="role">Rôle</label>
          <input id="role" className="input" value={p.jobRole ?? ""} onChange={(e) => set({ jobRole: e.target.value })} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="activity">Activité en une phrase</label>
          <input id="activity" className="input" value={p.activity ?? ""} onChange={(e) => set({ activity: e.target.value })} placeholder="ex. cabinet de conseil en organisation" />
        </div>
      </div>
    ),
    summary: (p) => `${p.jobRole ?? "Rôle ?"} — ${p.company ?? "entreprise ?"}${p.activity ? ` (${p.activity})` : ""}`,
  },
  {
    id: "locale",
    question: () => "Dans quelle langue et quel fuseau horaire travaillez-vous ?",
    render: (p, set) => (
      <div className="grid-2">
        <div className="field">
          <label htmlFor="lang">Langue</label>
          <select id="lang" className="select" value={p.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tz">Fuseau horaire</label>
          <select id="tz" className="select" value={p.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {(Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone").map((z) => <option key={z}>{z}</option>) ?? <option>{p.timezone}</option>}
          </select>
        </div>
      </div>
    ),
    summary: (p) => `${p.language === "fr" ? "Français" : p.language} · ${p.timezone}`,
  },
  {
    id: "hours",
    question: () => "Quels sont vos jours et horaires de travail ?",
    hint: "Je ne proposerai pas de rendez-vous en dehors.",
    render: (p, set) => (
      <div className="stack-12">
        <div className="chips">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button type="button" key={d} className="chip" aria-pressed={p.workDays.includes(d)} onClick={() => set({ workDays: toggle(p.workDays, d) })}>
              {DAYS[d]}
            </button>
          ))}
        </div>
        <div className="row">
          <input type="time" className="input" style={{ width: 140 }} value={p.workStart} onChange={(e) => set({ workStart: e.target.value })} aria-label="Début" />
          <span className="muted">à</span>
          <input type="time" className="input" style={{ width: 140 }} value={p.workEnd} onChange={(e) => set({ workEnd: e.target.value })} aria-label="Fin" />
        </div>
      </div>
    ),
    summary: (p) => `${p.workDays.map((d) => DAYS[d]).join(", ")} · ${p.workStart}–${p.workEnd}`,
  },
  {
    id: "tasks",
    question: () => "Quelles tâches répétitives aimeriez-vous me confier ?",
    render: (p, set, { preset }) => <MultiChoice options={preset?.repetitiveTasks ?? []} value={p.repetitiveTasks} onChange={(v) => set({ repetitiveTasks: v })} freeLabel="Autre tâche" />,
    summary: (p) => `Tâches : ${p.repetitiveTasks.join(", ") || "—"}`,
  },
  {
    id: "priorities",
    question: () => "Qu'est-ce qui est prioritaire pour vous ?",
    render: (p, set, { preset }) => <MultiChoice options={preset?.priorities ?? []} value={p.priorities} onChange={(v) => set({ priorities: v })} freeLabel="Autre priorité" />,
    summary: (p) => `Priorités : ${p.priorities.join(", ") || "—"}`,
  },
  {
    id: "tools",
    question: () => "Quels outils utilisez-vous au quotidien ?",
    hint: "Je vous dirai honnêtement lesquels je peux connecter aujourd'hui.",
    render: (p, set, { preset }) => (
      <MultiChoice options={["Gmail", "Google Agenda", "Outlook", "Calendrier Microsoft", ...(preset?.typicalTools ?? [])]} value={p.tools} onChange={(v) => set({ tools: v })} freeLabel="Autre outil" />
    ),
    summary: (p) => `Outils : ${p.tools.join(", ") || "—"}`,
  },
  {
    id: "style",
    question: () => "Quel style de communication dois-je adopter dans vos messages ?",
    render: (p, set) => (
      <div className="stack-12">
        <div className="chips">
          {["cordial et concis", "chaleureux", "formel", "très direct"].map((t) => (
            <button type="button" key={t} className="chip" aria-pressed={p.tone === t} onClick={() => set({ tone: t })}>
              {t}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={p.tutoiement} onChange={(e) => set({ tutoiement: e.target.checked })} /> Me tutoyer
        </label>
      </div>
    ),
    summary: (p) => `Ton : ${p.tone}${p.tutoiement ? " · tutoiement" : ""}`,
  },
  {
    id: "signature",
    question: () => "Quelle signature dois-je utiliser ?",
    hint: "Vous pourrez créer des modèles de messages ensuite (Réglages → Modèles).",
    render: (p, set) => <textarea className="textarea" rows={4} value={p.signature ?? ""} onChange={(e) => set({ signature: e.target.value })} aria-label="Signature" />,
    summary: (p) => `Signature : ${p.signature ? p.signature.split("\n")[0] : "—"}`,
  },
  {
    id: "contacts",
    question: () => "Avez-vous des contacts prioritaires ? (adresses séparées par des virgules)",
    render: (p, set) => (
      <input
        className="input"
        defaultValue={p.priorityContacts.map((c) => c.email).join(", ")}
        onBlur={(e) => set({ priorityContacts: e.target.value.split(/[,;\s]+/).filter((x) => x.includes("@")).map((email) => ({ email })) })}
        aria-label="Contacts prioritaires"
      />
    ),
    summary: (p) => `Contacts prioritaires : ${p.priorityContacts.map((c) => c.email).join(", ") || "—"}`,
  },
  {
    id: "meetings",
    question: () => "Comment préférez-vous vos rendez-vous ?",
    when: (p) => p.tools.some((t) => /agenda|calendrier|outlook/i.test(t)) || p.repetitiveTasks.some((t) => /rendez-vous|visite|démonstration|créneau/i.test(t)),
    render: (p, set) => (
      <div className="grid-2">
        <div className="field">
          <label htmlFor="dur">Durée par défaut (min)</label>
          <input id="dur" type="number" className="input" value={p.meetingPrefs.defaultDurationMin} onChange={(e) => set({ meetingPrefs: { ...p.meetingPrefs, defaultDurationMin: Number(e.target.value) } })} />
        </div>
        <div className="field">
          <label htmlFor="buf">Pause entre deux rendez-vous (min)</label>
          <input id="buf" type="number" className="input" value={p.meetingPrefs.bufferMin} onChange={(e) => set({ meetingPrefs: { ...p.meetingPrefs, bufferMin: Number(e.target.value) } })} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="label">Mode préféré</span>
          <div className="chips">
            {([["visio", "Visio"], ["phone", "Téléphone"], ["in_person", "En personne"]] as const).map(([v, l]) => (
              <button type="button" key={v} className="chip" aria-pressed={p.meetingPrefs.preferredMode === v} onClick={() => set({ meetingPrefs: { ...p.meetingPrefs, preferredMode: v } })}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    summary: (p) => `Rendez-vous : ${p.meetingPrefs.defaultDurationMin} min, pause ${p.meetingPrefs.bufferMin} min, ${p.meetingPrefs.preferredMode}`,
  },
  {
    id: "briefing",
    question: () => "À quelle heure voulez-vous votre point quotidien, et que doit-il contenir ?",
    hint: "Il est préparé par le serveur, même si la page est fermée.",
    render: (p, set) => (
      <div className="stack-12">
        <input type="time" className="input" style={{ width: 140 }} value={p.briefingTime} onChange={(e) => set({ briefingTime: e.target.value })} aria-label="Heure du point" />
        <div className="chips">
          {(
            [
              ["messages", "Messages importants"],
              ["actions", "Actions effectuées"],
              ["approvals", "À valider"],
              ["agenda", "Agenda et échéances"],
              ["priorities", "Priorités proposées"],
              ["errors", "Erreurs"],
            ] as const
          ).map(([k, l]) => (
            <button type="button" key={k} className="chip" aria-pressed={p.briefingContent[k]} onClick={() => set({ briefingContent: { ...p.briefingContent, [k]: !p.briefingContent[k] } })}>
              {l}
            </button>
          ))}
        </div>
      </div>
    ),
    summary: (p) => `Point à ${p.briefingTime}`,
  },
  {
    id: "voice",
    question: (p) => `Quelle voix dois-je avoir, ${p.firstName ?? ""} ?`.replace(" ,", ","),
    render: (p, set, { voices }) => (
      <div className="chips">
        {voices.map((v) => (
          <button type="button" key={v.id} className="chip" aria-pressed={p.assistantVoice === v.id} onClick={() => set({ assistantVoice: v.id })}>
            {v.label}
          </button>
        ))}
      </div>
    ),
    summary: (p) => `Voix : ${p.assistantVoice}`,
  },
];

export function Onboarding() {
  const nav = useNavigate();
  const me = useMe();
  const presets = useQuery({ queryKey: ["presets"], queryFn: () => api<{ professions: ProfessionPreset[]; voices: { id: string; label: string }[] }>("/api/presets") });
  const prof = useQuery({ queryKey: ["profile"], queryFn: () => api<{ profile: Profile; autonomy: Record<Category, AutonomyLevel> }>("/api/profile") });
  const [p, setP] = useState<Profile | null>(null);
  const [autonomy, setAutonomy] = useState<Record<Category, AutonomyLevel> | null>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"questions" | "autonomy" | "accounts" | "recap">("questions");
  const [readAloud, setReadAloud] = useState(false);
  const [dictating, setDictating] = useState(false);
  const dict = useRef(new Dictation());

  useEffect(() => {
    if (prof.data && !p) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setP({ ...prof.data.profile, timezone: prof.data.profile.timezone === "Europe/Paris" ? tz : prof.data.profile.timezone });
      setAutonomy(prof.data.autonomy);
      const idx = STEPS.findIndex((s) => s.id === prof.data.profile.onboardingStep);
      if (idx > 0) setI(idx);
    }
  }, [prof.data, p]);

  const steps = useMemo(() => (p ? STEPS.filter((s) => !s.when || s.when(p)) : STEPS), [p]);
  const step = steps[Math.min(i, steps.length - 1)];
  const preset = presets.data?.professions.find((x) => x.id === p?.professionPreset);

  useEffect(() => {
    if (readAloud && p && phase === "questions") speakLocally(step.question(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, readAloud, phase]);

  const save = useMutation({ mutationFn: (patch: Partial<Profile>) => api("/api/profile", { method: "PUT", body: patch }) });
  const finish = useMutation({
    mutationFn: async () => {
      await api("/api/profile", { method: "PUT", body: cleanProfile(p!) });
      for (const c of CATEGORIES) await api("/api/autonomy", { method: "PUT", body: { category: c, level: autonomy![c] } });
      await api("/api/onboarding/complete", { method: "POST" });
    },
    onSuccess: async () => {
      // Relire la session avant de naviguer, sinon le garde renverrait vers l'onboarding.
      await queryClient.refetchQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries();
      nav("/");
    },
  });

  if (!p || !presets.data || !autonomy) return <div className="onb muted">Chargement…</div>;
  const set = (patch: Partial<Profile>) => setP((cur) => ({ ...cur!, ...patch }));
  const next = async () => {
    await save.mutateAsync({ ...cleanProfile(pick(p, step.id)), onboardingStep: steps[i + 1]?.id ?? "autonomy" } as Partial<Profile>).catch(() => undefined);
    if (step.id === "profession" && preset && p.repetitiveTasks.length === 0) set({ repetitiveTasks: preset.repetitiveTasks.slice(0, 2), priorities: preset.priorities.slice(0, 2) });
    if (i + 1 < steps.length) setI(i + 1);
    else setPhase("autonomy");
  };
  const dictate = async () => {
    if (!dictating) {
      try {
        await dict.current.start();
        setDictating(true);
      } catch {
        alert("Micro indisponible.");
      }
      return;
    }
    setDictating(false);
    const t = await dict.current.stop().catch((e: Error) => {
      alert(e.message);
      return "";
    });
    if (!t) return;
    const clean = t.trim().replace(/[.!]$/, "");
    if (step.id === "first_name") set({ firstName: clean });
    else if (step.id === "assistant_name") set({ assistantName: clean });
    else if (step.id === "signature") set({ signature: clean });
    else if (step.id === "company") set({ activity: clean });
    else if (step.id === "tasks") set({ repetitiveTasks: [...p.repetitiveTasks, clean] });
    else if (step.id === "priorities") set({ priorities: [...p.priorities, clean] });
    else if (step.id === "tools") set({ tools: [...p.tools, clean] });
  };

  return (
    <div className="onb stack-16">
      <div className="spread">
        <div className="row">
          <span className="orb" style={{ width: 36, height: 36 }} aria-hidden />
          <strong>{p.assistantName || "Waverti"}</strong>
        </div>
        <label className="check small">
          <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} /> Lire les questions à voix haute
        </label>
      </div>
      <div className="progress" aria-label="Progression">
        <div style={{ width: `${phase === "questions" ? ((i + 1) / (steps.length + 3)) * 100 : phase === "autonomy" ? 85 : phase === "accounts" ? 92 : 100}%` }} />
      </div>

      {phase === "questions" && (
        <div className="card card-pad stack-16">
          <div className="bubble assistant" style={{ maxWidth: "100%" }}>
            {step.question(p)}
          </div>
          {step.hint && <p className="small muted">{step.hint}</p>}
          {step.render(p, set, { preset, presets: presets.data.professions, voices: presets.data.voices as unknown as { id: string; label: string }[] })}
          <div className="spread">
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
              Précédent
            </button>
            <div className="row">
              {me.data?.voiceAvailable && ["first_name", "assistant_name", "company", "tasks", "priorities", "tools", "signature"].includes(step.id) && (
                <button className="btn mic-btn" aria-pressed={dictating} onClick={() => void dictate()}>
                  <Icon.Mic /> {dictating ? "Terminer la dictée" : "Répondre à la voix"}
                </button>
              )}
              <button className="btn primary" onClick={() => void next()}>
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "autonomy" && (
        <div className="card card-pad stack-16">
          <div className="bubble assistant" style={{ maxWidth: "100%" }}>
            Que puis-je faire seul ? Par défaut, je prépare et j'attends votre validation. L'exécution automatique ne s'applique qu'aux règles que vous aurez confirmées.
          </div>
          <AutonomyEditor value={autonomy} onChange={setAutonomy} />
          <div className="info-box">
            <strong>Exemples</strong> — Sans validation : créer un brouillon, une tâche ; en mode automatique, appliquer une règle confirmée (ex. classer une newsletter, répondre avec un modèle approuvé à une demande simple). Toujours avec validation : un message contenant un montant, une pièce jointe, un sujet juridique, un destinataire inconnu, un conflit d'agenda, une suppression définitive.
          </div>
          <div className="spread">
            <button className="btn ghost" onClick={() => setPhase("questions")}>
              Précédent
            </button>
            <button className="btn primary" onClick={() => setPhase("accounts")}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {phase === "accounts" && (
        <div className="card card-pad stack-16">
          <div className="bubble assistant" style={{ maxWidth: "100%" }}>
            Connectons vos comptes. Je ne demande que les autorisations nécessaires aux fonctions que vous activez ; vous pourrez en ajouter plus tard.
            {p.tools.some((t) => /outlook|microsoft/i.test(t)) ? " Vous utilisez Outlook : commencez par Microsoft." : ""}
          </div>
          <ConnectButtons />
          <div className="spread">
            <button className="btn ghost" onClick={() => setPhase("autonomy")}>
              Précédent
            </button>
            <button className="btn primary" onClick={() => setPhase("recap")}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {phase === "recap" && (
        <div className="card card-pad stack-16">
          <h2>Récapitulatif</h2>
          <p className="small muted">Cliquez sur une ligne pour la modifier.</p>
          <ul className="list">
            {steps.map((s, idx) => (
              <li key={s.id}>
                <button
                  className="list-item"
                  style={{ padding: "8px 0" }}
                  onClick={() => {
                    setI(idx);
                    setPhase("questions");
                  }}
                >
                  <span className="grow small">{s.summary(p)}</span>
                  <Icon.Edit width={14} height={14} />
                </button>
              </li>
            ))}
            <li>
              <button className="list-item" style={{ padding: "8px 0" }} onClick={() => setPhase("autonomy")}>
                <span className="grow small">Autonomie : {CATEGORIES.map((c) => `${CATEGORY_LABELS[c]} — ${autonomy[c] === "observe" ? "consultation" : autonomy[c] === "prepare" ? "validation" : "auto"}`).join(" · ")}</span>
                <Icon.Edit width={14} height={14} />
              </button>
            </li>
          </ul>
          <button className="btn primary" disabled={finish.isPending} onClick={() => finish.mutate()}>
            Activer {p.assistantName}
          </button>
        </div>
      )}
    </div>
  );
}

export function AutonomyEditor({ value, onChange }: { value: Record<Category, AutonomyLevel>; onChange: (v: Record<Category, AutonomyLevel>) => void }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Catégorie</th>
          <th>Niveau</th>
        </tr>
      </thead>
      <tbody>
        {CATEGORIES.map((c) => (
          <tr key={c}>
            <td>
              {CATEGORY_LABELS[c]}
              {(c === "crm" || c === "documents") && <div className="tiny muted">Connecteur prévu, pas encore disponible</div>}
            </td>
            <td>
              <select className="select" value={value[c]} onChange={(e) => onChange({ ...value, [c]: e.target.value as AutonomyLevel })} aria-label={`Autonomie ${CATEGORY_LABELS[c]}`}>
                {(["observe", "prepare", "auto"] as const).map((l) => (
                  <option key={l} value={l}>
                    {AUTONOMY_LABELS[l]}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FIELDS: Record<string, (keyof Profile)[]> = {
  first_name: ["firstName"],
  assistant_name: ["assistantName"],
  profession: ["professionPreset"],
  company: ["company", "jobRole", "activity"],
  locale: ["language", "timezone"],
  hours: ["workDays", "workStart", "workEnd"],
  tasks: ["repetitiveTasks"],
  priorities: ["priorities"],
  tools: ["tools"],
  style: ["tone", "tutoiement"],
  signature: ["signature"],
  contacts: ["priorityContacts"],
  meetings: ["meetingPrefs"],
  briefing: ["briefingTime", "briefingContent"],
  voice: ["assistantVoice"],
};

function pick(p: Profile, stepId: string): Partial<Profile> {
  const out: Partial<Profile> = {};
  for (const k of FIELDS[stepId] ?? []) (out as Record<string, unknown>)[k as string] = p[k];
  return out;
}

const EDITABLE = Object.values(FIELDS).flat();
function cleanProfile(p: Partial<Profile>): Partial<Profile> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (!EDITABLE.includes(k as keyof Profile)) continue;
    if (v === null && k !== "signature") continue;
    out[k] = typeof v === "string" && k !== "signature" ? v.trim() : v;
  }
  if (out.assistantName === "") delete out.assistantName;
  return out as Partial<Profile>;
}
