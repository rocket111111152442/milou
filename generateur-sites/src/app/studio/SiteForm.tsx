"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, LIBRARY, formatPrice } from "@/lib/catalog";
import { shrinkImage } from "@/lib/client-image";
import {
  KINDS,
  PALETTES,
  SERVICES,
  WEEK_LABELS,
  copyOf,
  defaultSelection,
  slugify,
  type Kind,
  type PaletteId,
  type PublicTenant,
} from "@/lib/tenant";
import { buildShops, emptyShop, type ShopInput, type TenantInput } from "@/lib/tenant-input";
import { saveSite, uploadSitePhoto, type SaveResult } from "./actions";
import { accessMessage } from "./SiteCard";

const field = "h-11 w-full rounded-xl border border-mie bg-farine px-3 outline-none focus:border-croute focus:ring-4 focus:ring-croute/10";
const area = "w-full rounded-xl border border-mie bg-farine px-3 py-2 outline-none focus:border-croute focus:ring-4 focus:ring-croute/10";

const toEuros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
function parseEuros(v: string): number | null {
  const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 100) : null;
}

function Card({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-creme p-6 ring-1 ring-mie sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cafe font-display text-lg text-creme">{n}</span>
        <div>
          <h2 className="font-display text-2xl tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-grege">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ children, hint, className = "" }: { children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <span className={`mb-1 block text-sm font-semibold ${className}`}>
      {children}
      {hint && <span className="ml-2 text-xs font-normal text-grege">{hint}</span>}
    </span>
  );
}

function PhotoField({ label, value, onChange, hint }: { label: string; value?: string; onChange: (v: string | undefined) => void; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", await shrinkImage(file));
      onChange(await uploadSitePhoto(fd));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="relative grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-sable bg-farine text-xs text-grege transition hover:border-croute"
        >
          {value ? <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="px-2 text-center">📷 Ajouter</span>}
          {busy && <span className="absolute inset-0 grid place-items-center bg-creme/80 text-xs font-semibold text-cafe">Envoi…</span>}
        </button>
        <div className="text-xs text-grege">
          {value ? (
            <button type="button" onClick={() => onChange(undefined)} className="font-semibold text-red-700 hover:underline">
              Retirer la photo
            </button>
          ) : (
            "Facultatif : sans photo, une image d'illustration est utilisée."
          )}
          {error && <p className="mt-1 text-red-700">{error}</p>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

function HoursEditor({ value, onChange }: { value: ShopInput["hours"]; onChange: (v: ShopInput["hours"]) => void }) {
  const set = (i: number, patch: Partial<ShopInput["hours"][number]>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const time = "h-10 w-[104px] rounded-lg border border-mie bg-farine px-2 text-sm tabular-nums outline-none focus:border-croute";
  return (
    <div>
      <div className="divide-y divide-mie overflow-hidden rounded-2xl ring-1 ring-mie">
        {value.map((d, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-farine/60 px-4 py-2.5">
            <label className="flex w-32 cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={d.open} onChange={(e) => set(i, { open: e.target.checked })} className="h-4 w-4 accent-olive" />
              {WEEK_LABELS[i]}
            </label>
            {d.open ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="time" value={d.from} onChange={(e) => set(i, { from: e.target.value })} className={time} aria-label={`${WEEK_LABELS[i]} ouverture`} />
                <span>→</span>
                <input type="time" value={d.to} onChange={(e) => set(i, { to: e.target.value })} className={time} aria-label={`${WEEK_LABELS[i]} fermeture`} />
                {d.from2 !== undefined ? (
                  <>
                    <span className="ml-2 text-grege">puis</span>
                    <input type="time" value={d.from2 || ""} onChange={(e) => set(i, { from2: e.target.value })} className={time} aria-label={`${WEEK_LABELS[i]} réouverture`} />
                    <span>→</span>
                    <input type="time" value={d.to2 || ""} onChange={(e) => set(i, { to2: e.target.value })} className={time} aria-label={`${WEEK_LABELS[i]} fermeture du soir`} />
                    <button type="button" onClick={() => set(i, { from2: undefined, to2: undefined })} className="text-xs font-semibold text-red-700 hover:underline">
                      retirer
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => set(i, { from2: "15:00", to2: "19:00" })} className="ml-2 text-xs font-semibold text-croute hover:underline">
                    + coupure (pause midi)
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-grege">Fermé</span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(value.map((d, i) => (i < 6 && i > 0 ? { ...value[0], open: value[0].open } : d)))}
        className="mt-2 text-xs font-semibold text-croute hover:underline"
      >
        Recopier les horaires du lundi sur mardi → samedi
      </button>
    </div>
  );
}

export function SiteForm({ initial, editSlug }: { initial: TenantInput; editSlug?: string }) {
  const [input, setInput] = useState<TenantInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(editSlug));
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initial.products.map((p) => p.id)));
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const given = new Map(initial.products.map((p) => [p.id, p.price]));
    return Object.fromEntries(LIBRARY.map((p) => [p.id, toEuros(given.get(p.id) ?? p.price)]));
  });
  const [touchedProducts, setTouchedProducts] = useState(Boolean(editSlug));
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<SaveResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const set = (patch: Partial<TenantInput>) => setInput((s) => ({ ...s, ...patch }));
  const setShop = (i: number, patch: Partial<ShopInput>) => setInput((s) => ({ ...s, shops: s.shops.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const kind = KINDS.find((k) => k.id === input.kind)!;

  // Aperçu des textes générés (affichés en grisé dans les champs libres)
  const preview = useMemo(() => {
    const built = buildShops({ ...input, shops: input.shops.map((s) => ({ ...s, street: s.street || "—", postalCode: s.postalCode || "00000", phone: s.phone || "00 00 00 00 00", city: s.city || "votre ville" })) }, input.kind);
    const shops = "shops" in built ? built.shops : [];
    const t = {
      slug: "x",
      createdAt: "",
      updatedAt: "",
      kind: input.kind,
      name: input.name || "Votre commerce",
      tagline: input.tagline || kind.tagline,
      since: Number(input.since) || undefined,
      story: undefined,
      heroIntro: undefined,
      palette: input.palette,
      shops,
      products: LIBRARY.filter((p) => checked.has(p.id)),
    } satisfies PublicTenant;
    return copyOf(t);
  }, [input, checked, kind.tagline]);

  const chooseKind = (k: Kind) => {
    set({ kind: k });
    if (!touchedProducts) setChecked(new Set(defaultSelection(k)));
  };

  const toggleProduct = (id: string, on: boolean) => {
    setTouchedProducts(true);
    setChecked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const submit = () => {
    setError(null);
    const products: TenantInput["products"] = [];
    for (const p of LIBRARY) {
      if (!checked.has(p.id)) continue;
      const cents = parseEuros(prices[p.id]);
      if (cents === null) return setError(`Prix invalide pour « ${p.name} » (ex. 3,50).`);
      products.push({ id: p.id, price: cents });
    }
    start(async () => {
      try {
        const r = await saveSite({ ...input, products }, editSlug);
        if (r.ok) {
          setResult(r);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else setError(r.error);
      } catch (e) {
        setError(`Échec : ${(e as Error).message}`);
      }
    });
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copiez le texte :", text);
    }
  };

  if (result) {
    const origin = window.location.origin;
    const siteUrl = `${origin}/s/${result.slug}`;
    const adminUrl = `${siteUrl}/admin`;
    const message = accessMessage(input.name, siteUrl, adminUrl, result.password);
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-creme p-8 ring-1 ring-mie sm:p-10">
          <p className="text-5xl">🎉</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">{result.created ? "Le site est prêt !" : "Modifications enregistrées"}</h1>
          <p className="mt-2 text-cafe/70">
            {result.created ? "Le site est en ligne dès maintenant. " : ""}Il fonctionne en mode démonstration : les commandes de test sont enregistrées et marquées « Test » dans l&apos;espace boutiques.
          </p>

          <dl className="mt-8 grid gap-4">
            <div className="rounded-2xl bg-farine p-4">
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-grege">Le site</dt>
              <dd className="mt-1 break-all font-semibold">{siteUrl}</dd>
            </div>
            <div className="rounded-2xl bg-farine p-4">
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-grege">Espace boutiques (commandes, prix, produits)</dt>
              <dd className="mt-1 break-all font-semibold">{adminUrl}</dd>
              {result.password ? (
                <dd className="mt-2 text-sm">
                  Mot de passe : <code className="rounded bg-creme px-2 py-1 text-base font-bold">{result.password}</code>
                  <span className="ml-2 text-xs text-grege">à noter maintenant : il ne sera plus affiché (vous pourrez en générer un nouveau).</span>
                </dd>
              ) : (
                <dd className="mt-2 text-sm text-grege">Le mot de passe n&apos;a pas changé.</dd>
              )}
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-full bg-croute px-7 font-semibold text-creme transition hover:bg-cafe">
              Voir le site ↗
            </a>
            <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-full border border-mie px-6 font-semibold transition hover:bg-mie">
              Espace boutiques ↗
            </a>
            <button type="button" onClick={() => copy("msg", message)} className="inline-flex h-12 items-center rounded-full border border-mie px-6 font-semibold transition hover:bg-mie">
              {copied === "msg" ? "Message copié ✓" : "Copier le message pour le client"}
            </button>
          </div>

          <details className="mt-6 rounded-2xl bg-farine p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Aperçu du message</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans">{message}</pre>
          </details>

          <div className="mt-8 flex flex-wrap gap-4 border-t border-mie pt-6 text-sm font-semibold">
            <button type="button" onClick={() => setResult(null)} className="text-croute hover:underline">
              ← Continuer à modifier
            </button>
            <Link href="/studio" className="text-croute hover:underline">
              Tous les sites
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const nameForSlug = slugify(input.name);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-40 pt-8 sm:px-8">
      <p className="font-script text-2xl text-caramel">{editSlug ? "Modifier le site" : "Nouveau site"}</p>
      <h1 className="font-display text-4xl tracking-tight">{editSlug ? input.name || "Site" : "Les informations du commerce"}</h1>
      <p className="mt-1 max-w-2xl text-sm text-cafe/70">
        Seuls le nom, l&apos;adresse, le téléphone et les horaires sont indispensables. Tout le reste est généré automatiquement et se corrige ensuite, par vous ici ou par le
        commerçant dans son espace.
      </p>

      <div className="mt-8 grid gap-6">
        {/* 1. Commerce */}
        <Card n={1} title="Le commerce" hint="Identité affichée partout sur le site.">
          <div className="grid gap-5">
            <label className="block">
              <Label>Nom du commerce *</Label>
              <input
                value={input.name}
                onChange={(e) => {
                  const name = e.target.value;
                  set({ name, ...(slugTouched ? {} : { slug: slugify(name) }) });
                }}
                maxLength={60}
                className={field}
                placeholder="Ex. Boulangerie Dupont"
              />
            </label>

            <div>
              <Label>Type de commerce</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de commerce">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={input.kind === k.id}
                    onClick={() => chooseKind(k.id)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold ring-1 transition ${input.kind === k.id ? "bg-cafe text-creme ring-cafe" : "bg-farine ring-mie hover:bg-mie"}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <Label hint="facultatif">Sous-titre</Label>
                <input value={input.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={40} className={field} placeholder={kind.tagline} />
              </label>
              <label className="block">
                <Label hint="facultatif">Ouvert depuis</Label>
                <input value={input.since} onChange={(e) => set({ since: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" className={field} placeholder="2014" />
              </label>
              <label className="block">
                <Label hint="facultatif">Instagram</Label>
                <input value={input.instagram} onChange={(e) => set({ instagram: e.target.value })} className={field} placeholder="@nomducompte" />
              </label>
            </div>

            <div>
              <Label>Couleurs du site</Label>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Palette de couleurs">
                {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
                  const v = PALETTES[id].vars;
                  const on = input.palette === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ palette: id })}
                      className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-sm font-semibold ring-2 transition ${on ? "ring-croute" : "ring-transparent hover:ring-sable"}`}
                      style={{ background: v.farine }}
                    >
                      <span className="flex -space-x-1.5">
                        {[v.torref, v.croute, v.dore].map((c) => (
                          <span key={c} className="h-6 w-6 rounded-full ring-2" style={{ background: c, ["--tw-ring-color" as string]: v.farine }} />
                        ))}
                      </span>
                      <span style={{ color: v.cafe }}>{PALETTES[id].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <PhotoField label="Photo d'accueil" hint="grande image en haut du site" value={input.heroImage} onChange={(v) => set({ heroImage: v })} />
          </div>
        </Card>

        {/* 2. Boutiques */}
        <Card n={2} title="Les boutiques" hint="Une boutique, ou plusieurs adresses sous la même enseigne (jusqu'à 4).">
          <div className="grid gap-6">
            {input.shops.map((s, i) => (
              <div key={i} className="rounded-[1.5rem] bg-farine/60 p-5 ring-1 ring-mie">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-display text-xl">{input.shops.length > 1 ? `Boutique ${i + 1}` : "Adresse de la boutique"}</h3>
                  {input.shops.length > 1 && (
                    <button type="button" onClick={() => set({ shops: input.shops.filter((_, j) => j !== i) })} className="text-sm font-semibold text-red-700 hover:underline">
                      Supprimer cette boutique
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <Label hint="si différent du nom du commerce">Enseigne de la boutique</Label>
                    <input value={s.name} onChange={(e) => setShop(i, { name: e.target.value })} maxLength={60} className={field} placeholder={input.name || "Nom de la boutique"} />
                  </label>
                  <label className="block sm:col-span-2">
                    <Label>Adresse *</Label>
                    <input value={s.street} onChange={(e) => setShop(i, { street: e.target.value })} maxLength={100} className={field} placeholder="5 place du Marché" />
                  </label>
                  <label className="block">
                    <Label>Code postal *</Label>
                    <input value={s.postalCode} onChange={(e) => setShop(i, { postalCode: e.target.value })} maxLength={10} inputMode="numeric" className={field} placeholder="69002" />
                  </label>
                  <label className="block">
                    <Label>Ville *</Label>
                    <input value={s.city} onChange={(e) => setShop(i, { city: e.target.value })} maxLength={60} className={field} placeholder="Lyon" />
                  </label>
                  <label className="block">
                    <Label>Téléphone *</Label>
                    <input value={s.phone} onChange={(e) => setShop(i, { phone: e.target.value })} maxLength={25} inputMode="tel" className={field} placeholder="04 72 00 00 00" />
                  </label>
                  <label className="block">
                    <Label hint="facultatif">Repère</Label>
                    <input value={s.landmark} onChange={(e) => setShop(i, { landmark: e.target.value })} maxLength={110} className={field} placeholder="À deux pas de la gare, avec parking" />
                  </label>
                </div>

                <div className="mt-6">
                  <Label>Horaires d&apos;ouverture *</Label>
                  <HoursEditor value={s.hours} onChange={(hours) => setShop(i, { hours })} />
                </div>

                <div className="mt-6">
                  <Label>Services</Label>
                  <div className="flex flex-wrap gap-2">
                    {SERVICES.map((label) => {
                      const on = s.services.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setShop(i, { services: on ? s.services.filter((x) => x !== label) : [...s.services, label] })}
                          className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${on ? "bg-olive text-creme ring-olive" : "bg-creme ring-mie hover:bg-mie"}`}
                        >
                          {on && "✓ "}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6">
                  <PhotoField label="Photo de la boutique" hint="façade ou intérieur" value={s.image} onChange={(v) => setShop(i, { image: v })} />
                </div>

                <button type="button" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} className="mt-6 text-sm font-semibold text-croute hover:underline">
                  {open[i] ? "− Masquer" : "+ Afficher"} les mentions légales et l&apos;e-mail de commandes (facultatif)
                </button>
                <AnimatePresence initial={false}>
                  {open[i] && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid gap-4 pt-4 sm:grid-cols-2">
                        <label className="block">
                          <Label>Raison sociale</Label>
                          <input value={s.company} onChange={(e) => setShop(i, { company: e.target.value })} className={field} placeholder="SARL Dupont" />
                        </label>
                        <label className="block">
                          <Label>Forme juridique</Label>
                          <input value={s.form} onChange={(e) => setShop(i, { form: e.target.value })} className={field} placeholder="SARL, SAS, entreprise individuelle…" />
                        </label>
                        <label className="block">
                          <Label>SIREN</Label>
                          <input value={s.siren} onChange={(e) => setShop(i, { siren: e.target.value })} className={field} placeholder="123 456 789" />
                        </label>
                        <label className="block">
                          <Label>SIRET</Label>
                          <input value={s.siret} onChange={(e) => setShop(i, { siret: e.target.value })} className={field} placeholder="123 456 789 00012" />
                        </label>
                        <label className="block">
                          <Label>N° de TVA</Label>
                          <input value={s.vat} onChange={(e) => setShop(i, { vat: e.target.value })} className={field} placeholder="FR12345678901" />
                        </label>
                        <label className="block">
                          <Label>RCS</Label>
                          <input value={s.rcs} onChange={(e) => setShop(i, { rcs: e.target.value })} className={field} placeholder="RCS Toulon 123 456 789" />
                        </label>
                        <label className="block">
                          <Label>Année de création</Label>
                          <input value={s.created} onChange={(e) => setShop(i, { created: e.target.value.replace(/\D/g, "").slice(0, 4) })} className={field} placeholder="2014" />
                        </label>
                        <label className="block">
                          <Label hint="remplace l'e-mail général">E-mail de réception des commandes</Label>
                          <input value={s.orderEmail} onChange={(e) => setShop(i, { orderEmail: e.target.value })} type="email" className={field} placeholder="commandes@boulangerie.fr" />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
          {input.shops.length < 4 && (
            <button
              type="button"
              onClick={() => set({ shops: [...input.shops, { ...emptyShop(), hours: input.shops[0].hours.map((h) => ({ ...h })), services: [...input.shops[0].services] }] })}
              className="mt-5 h-11 rounded-full border border-mie bg-creme px-5 text-sm font-semibold transition hover:bg-mie"
            >
              + Ajouter une autre boutique
            </button>
          )}
        </Card>

        {/* 3. Textes */}
        <Card n={3} title="Les textes" hint="Générés automatiquement à partir de ce qui précède : écrivez seulement pour personnaliser.">
          <div className="grid gap-5">
            <label className="block">
              <Label hint="sous le titre de l'accueil">Phrase d&apos;accroche</Label>
              <textarea value={input.heroIntro} onChange={(e) => set({ heroIntro: e.target.value })} rows={2} maxLength={260} className={area} placeholder={preview.heroIntro} />
            </label>
            <label className="block">
              <Label hint="section « La maison »">Notre histoire</Label>
              <textarea value={input.story} onChange={(e) => set({ story: e.target.value })} rows={4} maxLength={600} className={area} placeholder={preview.story} />
            </label>
          </div>
        </Card>

        {/* 4. Carte */}
        <Card n={4} title="La carte" hint="Cochez ce que la boutique vend et corrigez les prix. Prix indicatifs : le commerçant pourra tout modifier et ajouter ses propres produits.">
          <div className="grid gap-8">
            {CATEGORIES.map((c) => {
              const list = LIBRARY.filter((p) => p.category === c.id);
              const count = list.filter((p) => checked.has(p.id)).length;
              return (
                <div key={c.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-xl">
                      {c.label} <span className="text-sm text-grege">{count}/{list.length}</span>
                    </h3>
                    <div className="flex gap-3 text-xs font-semibold text-croute">
                      <button type="button" onClick={() => list.forEach((p) => toggleProduct(p.id, true))} className="hover:underline">
                        Tout cocher
                      </button>
                      <button type="button" onClick={() => list.forEach((p) => toggleProduct(p.id, false))} className="hover:underline">
                        Tout décocher
                      </button>
                    </div>
                  </div>
                  <ul className="divide-y divide-mie overflow-hidden rounded-2xl ring-1 ring-mie">
                    {list.map((p) => {
                      const on = checked.has(p.id);
                      const bad = on && parseEuros(prices[p.id]) === null;
                      return (
                        <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 sm:flex-nowrap ${on ? "bg-creme" : "bg-farine/60 opacity-60"}`}>
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                            <input type="checkbox" checked={on} onChange={(e) => toggleProduct(p.id, e.target.checked)} className="h-5 w-5 shrink-0 accent-olive" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{p.name}</span>
                              <span className="block truncate text-xs text-grege">
                                {p.unit ? `${p.unit} · ` : ""}
                                {p.groups?.length ? `à composer (${p.groups.map((g) => g.label.toLowerCase()).join(", ")})` : `indicatif ${formatPrice(p.price)}`}
                              </span>
                            </span>
                          </label>
                          <label className="relative">
                            <span className="sr-only">Prix de {p.name}</span>
                            <input
                              inputMode="decimal"
                              value={prices[p.id]}
                              disabled={!on}
                              onChange={(e) => setPrices((s) => ({ ...s, [p.id]: e.target.value }))}
                              aria-invalid={bad}
                              className={`h-10 w-28 rounded-xl border bg-farine pl-3 pr-7 text-right font-semibold tabular-nums outline-none focus:ring-4 disabled:opacity-50 ${bad ? "border-red-400 focus:ring-red-100" : "border-mie focus:ring-croute/10"}`}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grege">€</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 5. Commandes & accès */}
        <Card n={5} title="Commandes et accès" hint="Comment la boutique reçoit les commandes, et l'adresse du site.">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <Label hint="facultatif — sans e-mail, les commandes arrivent dans l'espace boutiques (et par notification)">E-mail de réception des commandes</Label>
              <input value={input.orderEmail} onChange={(e) => set({ orderEmail: e.target.value })} type="email" className={field} placeholder="commandes@boulangerie.fr" />
            </label>
            <label className="block sm:col-span-2">
              <Label hint="facultatif — mentions légales">Directeur de la publication</Label>
              <input value={input.director} onChange={(e) => set({ director: e.target.value })} className={field} placeholder="Prénom Nom, gérant" />
            </label>
            <label className="block">
              <Label>Adresse du site</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-grege">/s/</span>
                <input
                  value={editSlug ?? input.slug}
                  disabled={Boolean(editSlug)}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: slugify(e.target.value) });
                  }}
                  className={`${field} disabled:opacity-60`}
                  placeholder={nameForSlug || "boulangerie-dupont"}
                />
              </div>
            </label>
            <label className="block">
              <Label hint={editSlug ? "vide = inchangé" : "vide = généré automatiquement"}>Mot de passe de l&apos;espace boutiques</Label>
              <input value={input.password} onChange={(e) => set({ password: e.target.value })} className={field} placeholder="8 caractères minimum" autoComplete="off" />
            </label>
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-full bg-cafe py-2.5 pl-6 pr-2.5 text-creme shadow-2xl">
        <span className={`py-1 text-sm ${error ? "text-dore" : "text-creme/70"}`}>{error ?? `${checked.size} produits · ${input.shops.length} boutique${input.shops.length > 1 ? "s" : ""}`}</span>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-11 rounded-full bg-dore px-6 text-sm font-semibold text-torref transition hover:bg-creme disabled:opacity-60"
        >
          {pending ? "Génération…" : editSlug ? "Enregistrer" : "Générer le site"}
        </button>
      </div>
    </div>
  );
}
