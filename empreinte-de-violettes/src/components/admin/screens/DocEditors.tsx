"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PLATE_NAMES } from "@/lib/plates";
import { cn } from "@/lib/cn";
import { DAYS } from "@/lib/format";
import type { AtelierSettings, Content, DeliverySettings, FulfillmentMode } from "@/lib/types";
import { Card, ImageField, ImagesField, Label, MoneyField, NumberField, PageHeader, SaveBar, TagsField, TextArea, TextField, Toggle, useDocEditor } from "../ui";

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function DaysPicker({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = value.includes(d);
          return (
            <button
              type="button"
              key={d}
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
              className={cn("w-11 rounded-lg border py-1.5 text-xs", on ? "border-aubergine-600 bg-aubergine-600 text-white" : "border-noir/10 text-noir/55")}
            >
              {DAYS[d].slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Atelier ----------------

export function AtelierEditor({ initial }: { initial: AtelierSettings }) {
  const { doc, setDoc, patch, dirty, saving, save, reset } = useDocEditor("atelier", initial);
  return (
    <div className="pb-24">
      <PageHeader title="Atelier de composition" subtitle="Fleurs, feuillages et emballages proposés aux clients pour composer leur bouquet" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card title="Règles">
          <div className="space-y-4">
            <Toggle label="Atelier ouvert" checked={doc.enabled} onChange={(v) => patch("enabled", v)} />
            <MoneyField label="Prix de la composition (main d'œuvre)" value={doc.basePrice} onChange={(v) => patch("basePrice", v ?? 0)} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Tiges minimum" value={doc.minStems} onChange={(v) => patch("minStems", v ?? 1)} />
              <NumberField label="Tiges maximum" value={doc.maxStems} onChange={(v) => patch("maxStems", v ?? 30)} />
            </div>
          </div>
        </Card>
        <Card
          title={`Fleurs & feuillages (${doc.flowers.length})`}
          actions={
            <button onClick={() => patch("flowers", [...doc.flowers, { id: uid("flw"), name: "Nouvelle fleur", color: "#B9A2CF", price: 300, active: true, kind: "fleur" }])} className="adm-btn adm-btn-ghost !text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          }
        >
          <div className="space-y-2">
            {doc.flowers.map((f, i) => {
              const up = (k: string, v: unknown) => setDoc((d) => ({ ...d, flowers: d.flowers.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
              return (
                <div key={f.id} className={cn("grid grid-cols-[auto_1fr_120px_110px_auto_auto] items-end gap-2 rounded-xl p-2 max-md:grid-cols-[auto_1fr_auto_auto]", !f.active && "opacity-50")}>
                  <input type="color" value={f.color} onChange={(e) => up("color", e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border border-noir/10" aria-label="Couleur" />
                  <input value={f.name} onChange={(e) => up("name", e.target.value)} className="adm-input" aria-label="Nom" />
                  <MoneyField label="" value={f.price} onChange={(v) => up("price", v ?? 0)} />
                  <span className="grid gap-1">
                    <select value={f.kind} onChange={(e) => up("kind", e.target.value)} className="adm-input" aria-label="Type">
                      <option value="fleur">Fleur</option>
                      <option value="feuillage">Feuillage</option>
                    </select>
                    <select value={f.plate || ""} onChange={(e) => up("plate", e.target.value || undefined)} className="adm-input !text-xs" aria-label="Gravure">
                      <option value="">Gravure auto</option>
                      {PLATE_NAMES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button onClick={() => up("active", !f.active)} className={cn("rounded-lg px-2 py-2 text-xs", f.active ? "text-emerald-700" : "text-noir/40")}>
                    {f.active ? "Actif" : "Masqué"}
                  </button>
                  <button onClick={() => setDoc((d) => ({ ...d, flowers: d.flowers.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-noir/35 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-noir/45">Astuce : la gravure est choisie d&apos;après le nom (rose, pivoine, renoncule, anémone, dahlia, tulipe, muflier, eucalyptus, fougère, olivier, graminées…) ; vous pouvez la forcer avec « Gravure ».</p>
        </Card>
        <Card
          title="Emballages"
          className="lg:col-span-2"
          actions={
            <button onClick={() => patch("wrappings", [...doc.wrappings, { id: uid("wrap"), name: "Nouvel emballage", price: 0, color: "#C9A27A" }])} className="adm-btn adm-btn-ghost !text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {doc.wrappings.map((w, i) => {
              const up = (k: string, v: unknown) => setDoc((d) => ({ ...d, wrappings: d.wrappings.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
              return (
                <div key={w.id} className="grid grid-cols-[auto_1fr_120px_auto] items-end gap-2">
                  <input type="color" value={w.color} onChange={(e) => up("color", e.target.value)} className="h-9 w-9 rounded-lg border border-noir/10" aria-label="Couleur" />
                  <input value={w.name} onChange={(e) => up("name", e.target.value)} className="adm-input" aria-label="Nom" />
                  <MoneyField label="" value={w.price} onChange={(v) => up("price", v ?? 0)} />
                  <button onClick={() => setDoc((d) => ({ ...d, wrappings: d.wrappings.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-noir/35 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}

// ---------------- Livraison ----------------

const MODES: { id: FulfillmentMode; label: string }[] = [
  { id: "delivery", label: "Livraison" },
  { id: "pickup", label: "Retrait" },
  { id: "drive", label: "Drive" },
];

export function DeliveryEditor({ initial }: { initial: DeliverySettings }) {
  const { doc, setDoc, patch, dirty, saving, save, reset } = useDocEditor("delivery", initial);
  const [blackout, setBlackout] = useState("");
  return (
    <div className="pb-24">
      <PageHeader title="Livraison & créneaux" subtitle="Zones, frais, créneaux horaires, délais et jours fermés" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Modes de réception">
          <div className="space-y-2">
            <Toggle label="Livraison" checked={doc.deliveryEnabled} onChange={(v) => patch("deliveryEnabled", v)} />
            <Toggle label="Retrait en boutique" checked={doc.pickupEnabled} onChange={(v) => patch("pickupEnabled", v)} />
            <Toggle label="Drive" checked={doc.driveEnabled} onChange={(v) => patch("driveEnabled", v)} />
          </div>
          <div className="mt-4 space-y-3">
            <TextArea label="Message retrait" rows={2} value={doc.pickupNote} onChange={(v) => patch("pickupNote", v)} />
            <TextArea label="Message Drive" rows={2} value={doc.driveNote} onChange={(v) => patch("driveNote", v)} />
          </div>
        </Card>
        <Card title="Délais">
          <div className="space-y-4">
            <NumberField label="Délai de préparation (heures)" value={doc.leadTimeHours} onChange={(v) => patch("leadTimeHours", v ?? 0)} step={0.5} />
            <TextField label="Heure limite jour même (livraison)" type="time" value={doc.sameDayCutoff} onChange={(v) => patch("sameDayCutoff", v)} />
            <NumberField label="Commande jusqu'à (jours à l'avance)" value={doc.maxDaysAhead} onChange={(v) => patch("maxDaysAhead", v ?? 30)} />
          </div>
        </Card>
        <Card title="Fermetures">
          <DaysPicker label="Jours fermés chaque semaine" value={doc.closedDays} onChange={(v) => patch("closedDays", v)} />
          <div className="mt-4">
            <Label>Dates sans livraison ni retrait</Label>
            <div className="flex gap-2">
              <input type="date" value={blackout} onChange={(e) => setBlackout(e.target.value)} className="adm-input" />
              <button
                type="button"
                className="adm-btn adm-btn-ghost"
                onClick={() => {
                  if (blackout && !doc.blackoutDates.includes(blackout)) patch("blackoutDates", [...doc.blackoutDates, blackout].sort());
                  setBlackout("");
                }}
              >
                Ajouter
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {doc.blackoutDates.map((d) => (
                <button key={d} onClick={() => patch("blackoutDates", doc.blackoutDates.filter((x) => x !== d))} className="rounded-full bg-noir/[0.06] px-2.5 py-1 text-xs hover:bg-red-50 hover:text-red-700">
                  {d} ×
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card
          title="Zones de livraison"
          className="lg:col-span-3"
          actions={
            <button onClick={() => patch("zones", [...doc.zones, { id: uid("zone"), name: "Nouvelle zone", postcodes: [], cities: [], fee: 1500, minOrder: 3000, freeFrom: null, active: true }])} className="adm-btn adm-btn-ghost !text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter une zone
            </button>
          }
        >
          <div className="space-y-4">
            {doc.zones.map((z, i) => {
              const up = (k: string, v: unknown) => setDoc((d) => ({ ...d, zones: d.zones.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
              return (
                <div key={z.id} className={cn("grid gap-3 rounded-xl border border-noir/[0.07] p-4 md:grid-cols-6", !z.active && "opacity-60")}>
                  <TextField className="md:col-span-2" label="Nom" value={z.name} onChange={(v) => up("name", v)} />
                  <MoneyField label="Frais" value={z.fee} onChange={(v) => up("fee", v ?? 0)} />
                  <MoneyField label="Minimum" value={z.minOrder} onChange={(v) => up("minOrder", v ?? 0)} />
                  <MoneyField label="Offerte dès" nullable value={z.freeFrom} onChange={(v) => up("freeFrom", v)} help="vide = jamais" />
                  <div className="flex items-end gap-2">
                    <button onClick={() => up("active", !z.active)} className={cn("adm-btn flex-1", z.active ? "adm-btn-ghost" : "bg-noir/10")}>
                      {z.active ? "Active" : "Inactive"}
                    </button>
                    <button onClick={() => setDoc((d) => ({ ...d, zones: d.zones.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-noir/35 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la zone">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <TagsField className="md:col-span-3" label="Codes postaux" value={z.postcodes} onChange={(v) => up("postcodes", v)} />
                  <TagsField className="md:col-span-3" label="Villes (affichage)" value={z.cities} onChange={(v) => up("cities", v)} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Créneaux"
          className="lg:col-span-3"
          actions={
            <button onClick={() => patch("slots", [...doc.slots, { id: uid("slot"), label: "Nouveau créneau", from: "10:00", to: "12:00", days: [2, 3, 4, 5, 6], modes: ["delivery", "pickup", "drive"], capacity: 10 }])} className="adm-btn adm-btn-ghost !text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter un créneau
            </button>
          }
        >
          <div className="space-y-4">
            {doc.slots.map((s, i) => {
              const up = (k: string, v: unknown) => setDoc((d) => ({ ...d, slots: d.slots.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
              return (
                <div key={s.id} className="grid gap-3 rounded-xl border border-noir/[0.07] p-4 md:grid-cols-6">
                  <TextField className="md:col-span-2" label="Libellé" value={s.label} onChange={(v) => up("label", v)} />
                  <TextField label="De" type="time" value={s.from} onChange={(v) => up("from", v)} />
                  <TextField label="À" type="time" value={s.to} onChange={(v) => up("to", v)} />
                  <NumberField label="Capacité / jour" nullable value={s.capacity} onChange={(v) => up("capacity", v)} help="vide = illimité" />
                  <div className="flex items-end justify-end">
                    <button onClick={() => setDoc((d) => ({ ...d, slots: d.slots.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-noir/35 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer le créneau">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="md:col-span-3">
                    <DaysPicker label="Jours" value={s.days} onChange={(v) => up("days", v)} />
                  </div>
                  <div className="md:col-span-3">
                    <Label>Modes</Label>
                    <div className="flex gap-1">
                      {MODES.map((m) => {
                        const on = s.modes.includes(m.id);
                        return (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => up("modes", on ? s.modes.filter((x) => x !== m.id) : [...s.modes, m.id])}
                            className={cn("rounded-lg border px-3 py-1.5 text-xs", on ? "border-aubergine-600 bg-aubergine-600 text-white" : "border-noir/10 text-noir/55")}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}

// ---------------- Contenus ----------------

const TABS = [
  ["hero", "Accueil"],
  ["seasonal", "Rendez-vous de saison"],
  ["about", "La Maison"],
  ["wedding", "Mariage"],
  ["funeral", "Deuil"],
  ["legal", "Pages légales"],
] as const;

export function ContentEditor({ initial }: { initial: Content }) {
  const { doc, setDoc, dirty, saving, save, reset } = useDocEditor("content", initial);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("hero");
  const sub = <K extends keyof Content>(k: K) => (field: keyof Content[K], v: unknown) => setDoc((d) => ({ ...d, [k]: { ...(d[k] as object), [field]: v } }));
  const hero = sub("hero");
  const man = sub("manifesto");
  const sea = sub("seasonal");
  const ab = sub("about");
  const wed = sub("wedding");
  const fun = sub("funeral");
  const leg = sub("legal");
  return (
    <div className="pb-24">
      <PageHeader title="Pages & textes" subtitle="Tous les textes et visuels du site, sans toucher au code" />
      <div className="mb-6 flex flex-wrap gap-1.5">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("rounded-full px-4 py-1.5 text-sm", tab === id ? "bg-aubergine-700 text-white" : "bg-white text-noir/60")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "hero" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Couverture de l'accueil">
            <div className="space-y-4">
              <p className="text-sm text-noir/55">La couverture reprend l&apos;étiquette noire de la carte de visite ; seuls les textes ci-dessous changent.</p>
              <TextArea label="Phrase sous l'étiquette" rows={3} value={doc.hero.subtitle} onChange={(v) => hero("subtitle", v)} />
              <TextField label="Lien vers la boutique" value={doc.hero.ctaLabel} onChange={(v) => hero("ctaLabel", v)} />
              <TextField label="Mention en bas à droite" value={doc.hero.eyebrow} onChange={(v) => hero("eyebrow", v)} help="ex. Maison fondée en avril 2022" />
              <ImagesField label="Photo de l'avant-propos" max={1} value={doc.hero.images} onChange={(v) => hero("images", v)} help="« Fig. 1 » de l'accueil" />
            </div>
          </Card>
          <div className="space-y-6">
            <Card title="Le geste (manifeste)">
              <div className="space-y-4">
                <TextField label="Titre courant" value={doc.manifesto.eyebrow} onChange={(v) => man("eyebrow", v)} help="la 1re phrase du texte s'affiche en grand" />
                <TextArea label="Texte" rows={6} value={doc.manifesto.text} onChange={(v) => man("text", v)} />
                <TextField label="Signature" value={doc.manifesto.signature} onChange={(v) => man("signature", v)} />
                <ImageField label="Image" value={doc.manifesto.image} onChange={(v) => man("image", v)} />
              </div>
            </Card>
            <Card title="En quelques notes (avant-propos)">
              <div className="space-y-2">
                {doc.stats.map((s, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr_auto] gap-2">
                    <input className="adm-input" value={s.value} onChange={(e) => setDoc((d) => ({ ...d, stats: d.stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} aria-label="Valeur" />
                    <input className="adm-input" value={s.label} onChange={(e) => setDoc((d) => ({ ...d, stats: d.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} aria-label="Libellé" />
                    <button onClick={() => setDoc((d) => ({ ...d, stats: d.stats.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-noir/35 hover:text-red-600" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {doc.stats.length < 6 && (
                  <button onClick={() => setDoc((d) => ({ ...d, stats: [...d.stats, { value: "100 %", label: "Nouveau chiffre" }] }))} className="adm-btn adm-btn-ghost !text-xs">
                    <Plus className="h-3.5 w-3.5" /> Ajouter
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "seasonal" && (
        <Card title="Bandeau saisonnier (Toussaint, Noël, Saint-Valentin, Fête des mères…)">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Toggle label="Afficher dans l'almanach de l'accueil" checked={doc.seasonal.active} onChange={(v) => sea("active", v)} />
            </div>
            <TextField label="Sur-titre" value={doc.seasonal.eyebrow} onChange={(v) => sea("eyebrow", v)} />
            <TextField label="Titre" value={doc.seasonal.title} onChange={(v) => sea("title", v)} />
            <TextArea className="md:col-span-2" label="Texte" rows={3} value={doc.seasonal.text} onChange={(v) => sea("text", v)} />
            <TextField label="Date de l'événement (masqué une fois passée)" type="datetime-local" value={doc.seasonal.targetDate.slice(0, 16)} onChange={(v) => sea("targetDate", v)} />
            <TextField label="Bouton" value={doc.seasonal.ctaLabel} onChange={(v) => sea("ctaLabel", v)} />
            <TextField className="md:col-span-2" label="Lien du bouton" value={doc.seasonal.ctaLink} onChange={(v) => sea("ctaLink", v)} help="ex. /boutique?categorie=fetes-et-saisons" />
          </div>
        </Card>
      )}

      {tab === "about" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Notre histoire">
            <div className="space-y-4">
              <TextField label="Titre" value={doc.about.title} onChange={(v) => ab("title", v)} />
              <TextArea label="Introduction" rows={3} value={doc.about.intro} onChange={(v) => ab("intro", v)} />
              {doc.about.paragraphs.map((p, i) => (
                <TextArea key={i} label={`Paragraphe ${i + 1}`} rows={4} value={p} onChange={(v) => ab("paragraphs", doc.about.paragraphs.map((x, j) => (j === i ? v : x)))} />
              ))}
              <button onClick={() => ab("paragraphs", [...doc.about.paragraphs, ""])} className="adm-btn adm-btn-ghost !text-xs">
                <Plus className="h-3.5 w-3.5" /> Paragraphe
              </button>
              <ImageField label="Photo" value={doc.about.image} onChange={(v) => ab("image", v)} />
            </div>
          </Card>
          <Card title="Engagements">
            <div className="space-y-3">
              {doc.about.values.map((v, i) => (
                <div key={i} className="rounded-xl border border-noir/[0.07] p-3">
                  <TextField label="Titre" value={v.title} onChange={(x) => ab("values", doc.about.values.map((y, j) => (j === i ? { ...y, title: x } : y)))} />
                  <TextArea className="mt-2" label="Texte" rows={2} value={v.text} onChange={(x) => ab("values", doc.about.values.map((y, j) => (j === i ? { ...y, text: x } : y)))} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "wedding" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Page Mariage">
            <div className="space-y-4">
              <TextField label="Titre (la partie après la virgule passe en doré)" value={doc.wedding.title} onChange={(v) => wed("title", v)} />
              <TextArea label="Introduction" rows={4} value={doc.wedding.intro} onChange={(v) => wed("intro", v)} />
              <TextArea label="Note (réservation, conditions)" rows={2} value={doc.wedding.priceNote} onChange={(v) => wed("priceNote", v)} />
              <ImageField label="Image principale" value={doc.wedding.image} onChange={(v) => wed("image", v)} />
            </div>
          </Card>
          <Card title="Étapes">
            <div className="space-y-3">
              {doc.wedding.steps.map((s, i) => (
                <div key={i} className="rounded-xl border border-noir/[0.07] p-3">
                  <TextField label={`Étape ${i + 1}`} value={s.title} onChange={(x) => wed("steps", doc.wedding.steps.map((y, j) => (j === i ? { ...y, title: x } : y)))} />
                  <TextArea className="mt-2" label="Texte" rows={2} value={s.text} onChange={(x) => wed("steps", doc.wedding.steps.map((y, j) => (j === i ? { ...y, text: x } : y)))} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "funeral" && (
        <Card title="Page Deuil">
          <div className="space-y-4">
            <TextField label="Titre" value={doc.funeral.title} onChange={(v) => fun("title", v)} />
            <TextArea label="Introduction" rows={4} value={doc.funeral.intro} onChange={(v) => fun("intro", v)} />
            <ImageField label="Image" value={doc.funeral.image} onChange={(v) => fun("image", v)} />
          </div>
        </Card>
      )}

      {tab === "legal" && (
        <div className="space-y-6">
          <Card title="Mentions légales">
            <TextArea label="Texte (une ligne vide = nouveau paragraphe)" rows={10} value={doc.legal.mentions} onChange={(v) => leg("mentions", v)} />
          </Card>
          <Card title="Conditions générales de vente">
            <TextArea label="Texte" rows={14} value={doc.legal.cgv} onChange={(v) => leg("cgv", v)} />
          </Card>
          <Card title="Confidentialité">
            <TextArea label="Texte" rows={8} value={doc.legal.privacy} onChange={(v) => leg("privacy", v)} />
          </Card>
        </div>
      )}
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
