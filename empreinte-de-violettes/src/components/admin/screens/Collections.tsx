"use client";

import { Mail, Plus, Star, Trash2 } from "lucide-react";
import { plateOptions } from "@/lib/plates";
import { euro, frDate, frDateTime } from "@/lib/format";
import type { Addon, Category, Faq, GalleryItem, Message, Occasion, Product, ProductVariant, PromoCode, Review, Subscriber } from "@/lib/types";
import { CollectionManager } from "../CollectionManager";
import { Badge, Label, MoneyField } from "../ui";

const img = (src?: string) => (src ? (src.startsWith("https://images.unsplash.com") ? `${src.split("?")[0]}?w=120&q=60&auto=format&fit=crop` : src) : "");

function Thumb({ src, round }: { src?: string; round?: boolean }) {
  return (
    <span className={`block h-12 w-10 overflow-hidden bg-aubergine-100 ${round ? "rounded-full" : "rounded-t-full"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={img(src)} alt="" className="h-full w-full object-cover" />}
    </span>
  );
}

function VariantsEditor({ value, onChange }: { value: ProductVariant[]; onChange: (v: ProductVariant[]) => void }) {
  return (
    <div>
      <Label help="laisser vide pour un prix unique">Tailles / variantes</Label>
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={v.id} className="flex items-end gap-2">
            <label className="flex-1">
              <input value={v.name} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="adm-input" placeholder="Nom (ex. Généreux)" />
            </label>
            <MoneyField label="" className="w-32" value={v.price} onChange={(p) => onChange(value.map((x, k) => (k === i ? { ...x, price: p ?? 0 } : x)))} />
            <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="mb-1 rounded-lg p-2 text-noir/40 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la variante">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, { id: `v-${Date.now().toString(36)}`, name: value.length === 0 ? "Classique" : value.length === 1 ? "Généreux" : "Somptueux", price: value[value.length - 1]?.price ?? 4000 }])}
          className="adm-btn adm-btn-ghost !text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter une variante
        </button>
      </div>
    </div>
  );
}

export function ProductsScreen({ items, categories, occasions }: { items: Product[]; categories: Category[]; occasions: Occasion[] }) {
  const catName = (id: string) => categories.find((c) => c.id === id)?.name || "—";
  return (
    <CollectionManager<Product & Record<string, unknown>>
      collection="products"
      title="Produits"
      singular="Produit"
      items={items as (Product & Record<string, unknown>)[]}
      searchKeys={["name", "subtitle", "star", "slug"]}
      sort={(a, b) => a.sortOrder - b.sortOrder}
      filters={{ label: "Toutes les catégories", options: categories.map((c) => ({ value: c.id, label: c.name })), test: (p, v) => p.categoryId === v }}
      columns={[
        {
          label: "Produit",
          render: (p) => (
            <span className="flex items-center gap-3">
              <Thumb src={p.images[0]} />
              <span>
                <span className="block font-medium">{p.name}</span>
                <span className="block text-xs text-noir/45">{p.subtitle}</span>
              </span>
            </span>
          ),
        },
        { label: "Catégorie", render: (p) => catName(p.categoryId) },
        { label: "Prix", render: (p) => <span className="tabular-nums">{p.variants.length ? `dès ${euro(Math.min(...p.variants.map((v) => v.price)))}` : euro(p.price)}</span> },
        {
          label: "Stock",
          render: (p) => (p.stock == null ? <span className="text-noir/40">∞</span> : <Badge className={p.stock <= 3 ? "bg-amber-100 text-amber-800" : undefined}>{p.stock}</Badge>),
        },
        {
          label: "Étiquettes",
          render: (p) => (
            <span className="flex flex-wrap gap-1">
              {p.featured && <Badge className="bg-gold/20 text-amber-800">Coup de cœur</Badge>}
              {p.isNew && <Badge className="bg-aubergine-100 text-aubergine-700">Nouveau</Badge>}
              {p.seasonal && <Badge>Saison</Badge>}
            </span>
          ),
        },
      ]}
      defaults={{ name: "", subtitle: "", description: "", categoryId: categories[0]?.id, occasionIds: [], price: 4000, variants: [], images: [], stock: null, active: true, featured: false, isNew: true, seasonal: false, colors: [], tags: [], sortOrder: items.length + 1 }}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "subtitle", label: "Sous-titre", type: "text" },
        { key: "categoryId", label: "Catégorie", type: "select", options: categories.map((c) => ({ value: c.id, label: c.name })) },
        { key: "star", label: "Étoile / constellation", type: "text", help: "facultatif" },
        { key: "plate", label: "Gravure de l'herbier", type: "select", options: [{ value: "", label: "Automatique (d'après le nom)" }, ...plateOptions], help: "illustration ancienne associée à la création" },
        { key: "description", label: "Description", type: "textarea", rows: 4 },
        { key: "details", label: "Entretien & détails", type: "textarea", rows: 3 },
        { key: "images", label: "Photos", type: "images", max: 8 },
        { type: "section", label: "Prix & stock" },
        { key: "price", label: "Prix de base", type: "money", help: "utilisé si pas de variantes" },
        { key: "compareAtPrice", label: "Prix barré", type: "money", nullable: true },
        { key: "variants", label: "Variantes", type: "custom", render: (v, set) => <VariantsEditor value={(v as ProductVariant[]) || []} onChange={set} /> },
        { key: "stock", label: "Stock", type: "number", nullable: true, help: "vide = illimité" },
        { key: "sortOrder", label: "Ordre d'affichage", type: "number" },
        { type: "section", label: "Classement & visibilité" },
        { key: "occasionIds", label: "Occasions", type: "multiselect", options: occasions.map((o) => ({ value: o.id, label: o.name })) },
        { key: "active", label: "En ligne", type: "toggle" },
        { key: "featured", label: "Coup de cœur (accueil)", type: "toggle" },
        { key: "isNew", label: "Nouveauté", type: "toggle" },
        { key: "seasonal", label: "De saison", type: "toggle" },
        { key: "deliveryOnly", label: "Livraison uniquement", type: "toggle" },
        { key: "pickupOnly", label: "Retrait uniquement", type: "toggle" },
        { key: "colors", label: "Teintes dominantes", type: "colors" },
        { key: "tags", label: "Mots-clés (recherche)", type: "tags" },
        { key: "slug", label: "Adresse (slug)", type: "text", help: "généré automatiquement si vide", span: 2 },
      ]}
    />
  );
}

export function CategoriesScreen({ items }: { items: Category[] }) {
  return (
    <CollectionManager<Category & Record<string, unknown>>
      collection="categories"
      title="Catégories"
      singular="Catégorie"
      items={items as (Category & Record<string, unknown>)[]}
      searchKeys={["name"]}
      sort={(a, b) => a.sortOrder - b.sortOrder}
      columns={[
        { label: "Catégorie", render: (c) => <span className="flex items-center gap-3"><Thumb src={c.image} /> <span className="font-medium">{c.name}</span></span> },
        { label: "Description", render: (c) => <span className="line-clamp-2 max-w-md text-noir/55">{c.description}</span> },
        { label: "Menu", render: (c) => (c.showInMenu ? "Oui" : "Non") },
        { label: "Ordre", render: (c) => c.sortOrder },
      ]}
      defaults={{ name: "", description: "", image: "", active: true, showInMenu: true, sortOrder: items.length + 1 }}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "description", label: "Description", type: "textarea", rows: 3 },
        { key: "image", label: "Image", type: "image" },
        { key: "plate", label: "Gravure de l'herbier", type: "select", options: [{ value: "", label: "Automatique" }, ...plateOptions] },
        { key: "active", label: "Visible", type: "toggle" },
        { key: "showInMenu", label: "Dans le menu", type: "toggle" },
        { key: "slug", label: "Adresse (slug)", type: "text", span: 2 },
      ]}
    />
  );
}

export function OccasionsScreen({ items }: { items: Occasion[] }) {
  return (
    <CollectionManager<Occasion & Record<string, unknown>>
      collection="occasions"
      title="Occasions"
      singular="Occasion"
      items={items as (Occasion & Record<string, unknown>)[]}
      searchKeys={["name"]}
      sort={(a, b) => a.sortOrder - b.sortOrder}
      columns={[
        { label: "Occasion", render: (o) => <span className="font-medium">{o.name}</span> },
        { label: "Adresse", render: (o) => <span className="text-noir/50">/boutique?occasion={o.slug}</span> },
        { label: "Ordre", render: (o) => o.sortOrder },
      ]}
      defaults={{ name: "", active: true, sortOrder: items.length + 1 }}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "active", label: "Visible", type: "toggle" },
        { key: "slug", label: "Adresse (slug)", type: "text" },
      ]}
    />
  );
}

export function AddonsScreen({ items }: { items: Addon[] }) {
  return (
    <CollectionManager<Addon & Record<string, unknown>>
      collection="addons"
      title="Options & cadeaux"
      subtitle="Proposés sur chaque fiche produit (vase, carte, bougie, chocolats…)"
      singular="Option"
      items={items as (Addon & Record<string, unknown>)[]}
      searchKeys={["name"]}
      sort={(a, b) => a.sortOrder - b.sortOrder}
      columns={[
        { label: "Option", render: (a) => <span className="flex items-center gap-3"><Thumb src={a.image} round /> <span><span className="block font-medium">{a.name}</span><span className="text-xs text-noir/45">{a.description}</span></span></span> },
        { label: "Prix", render: (a) => euro(a.price) },
      ]}
      defaults={{ name: "", description: "", price: 1000, image: "", active: true, sortOrder: items.length + 1 }}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "price", label: "Prix", type: "money" },
        { key: "description", label: "Description", type: "textarea", rows: 2 },
        { key: "image", label: "Image", type: "image" },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "active", label: "Proposée", type: "toggle" },
      ]}
    />
  );
}

export function PromosScreen({ items }: { items: PromoCode[] }) {
  const label = (p: PromoCode) => (p.type === "percent" ? `− ${p.value} %` : p.type === "fixed" ? `− ${euro(p.value)}` : "Livraison offerte");
  return (
    <CollectionManager<PromoCode & Record<string, unknown>>
      collection="promos"
      title="Codes promo"
      singular="Code"
      items={items as (PromoCode & Record<string, unknown>)[]}
      searchKeys={["code", "description"]}
      columns={[
        { label: "Code", render: (p) => <span className="rounded-md bg-aubergine-50 px-2 py-1 font-mono text-xs font-semibold text-aubergine-700">{p.code}</span> },
        { label: "Avantage", render: (p) => label(p) },
        { label: "Minimum", render: (p) => (p.minSubtotal ? euro(p.minSubtotal) : "—") },
        { label: "Utilisations", render: (p) => `${p.uses}${p.maxUses != null ? ` / ${p.maxUses}` : ""}` },
        { label: "Validité", render: (p) => <span className="text-xs text-noir/55">{p.startsAt ? frDate(p.startsAt.slice(0, 10)) : "…"} → {p.endsAt ? frDate(p.endsAt.slice(0, 10)) : "…"}</span> },
      ]}
      defaults={{ code: "", type: "percent", value: 10, minSubtotal: 0, uses: 0, active: true, maxUses: null, startsAt: null, endsAt: null, description: "" }}
      fields={[
        { key: "code", label: "Code", type: "text", required: true, help: "MAJUSCULES" },
        {
          key: "type",
          label: "Type",
          type: "select",
          options: [
            { value: "percent", label: "Pourcentage" },
            { value: "fixed", label: "Montant fixe" },
            { value: "free_delivery", label: "Livraison offerte" },
          ],
        },
        {
          key: "value",
          label: "Valeur",
          type: "custom",
          render: (v, set, item) =>
            item.type === "fixed" ? (
              <MoneyField label="Montant de la remise" value={(v as number) ?? 0} onChange={(x) => set(x ?? 0)} />
            ) : item.type === "percent" ? (
              <label className="block">
                <Label>Pourcentage</Label>
                <input type="number" min={1} max={100} value={(v as number) ?? 0} onChange={(e) => set(Number(e.target.value))} className="adm-input" />
              </label>
            ) : (
              <p className="text-sm text-noir/50">Les frais de livraison sont offerts.</p>
            ),
        },
        { key: "minSubtotal", label: "Achat minimum", type: "money" },
        { key: "maxUses", label: "Utilisations max", type: "number", nullable: true, help: "vide = illimité" },
        { key: "startsAt", label: "Début", type: "date" },
        { key: "endsAt", label: "Fin", type: "date" },
        { key: "description", label: "Note interne", type: "text", span: 2 },
        { key: "active", label: "Actif", type: "toggle" },
      ]}
    />
  );
}

export function ReviewsScreen({ items }: { items: Review[] }) {
  return (
    <CollectionManager<Review & Record<string, unknown>>
      collection="reviews"
      title="Avis clients"
      subtitle="Affichés sur l'accueil et la page Mariage"
      singular="Avis"
      items={items as (Review & Record<string, unknown>)[]}
      searchKeys={["author", "text", "source"]}
      columns={[
        { label: "Auteur", render: (r) => <span className="font-medium">{r.author}</span> },
        { label: "Avis", render: (r) => <span className="line-clamp-2 max-w-lg italic text-noir/65">« {r.text} »</span> },
        { label: "Note", render: (r) => <span className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />)}</span> },
        { label: "Source", render: (r) => r.source },
      ]}
      defaults={{ author: "", text: "", rating: 5, source: "Google", date: new Date().toISOString().slice(0, 10), active: true, featured: false }}
      fields={[
        { key: "author", label: "Auteur", type: "text", required: true },
        { key: "source", label: "Source", type: "text" },
        { key: "text", label: "Texte", type: "textarea", rows: 4 },
        {
          key: "rating",
          label: "Note",
          type: "select",
          options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: "★".repeat(n) })),
        },
        { key: "date", label: "Date", type: "date" },
        { key: "active", label: "Affiché", type: "toggle" },
        { key: "featured", label: "Mis en avant", type: "toggle" },
      ]}
    />
  );
}

export function FaqScreen({ items }: { items: Faq[] }) {
  return (
    <CollectionManager<Faq & Record<string, unknown>>
      collection="faqs"
      title="Questions fréquentes"
      singular="Question"
      items={items as (Faq & Record<string, unknown>)[]}
      searchKeys={["question", "answer", "category"]}
      sort={(a, b) => a.sortOrder - b.sortOrder}
      columns={[
        { label: "Question", render: (f) => <span className="font-medium">{f.question}</span> },
        { label: "Catégorie", render: (f) => <Badge>{f.category}</Badge> },
        { label: "Ordre", render: (f) => f.sortOrder },
      ]}
      defaults={{ question: "", answer: "", category: "Commande", sortOrder: items.length + 1, active: true }}
      fields={[
        { key: "question", label: "Question", type: "text", required: true, span: 2 },
        { key: "answer", label: "Réponse", type: "textarea", rows: 5 },
        { key: "category", label: "Catégorie", type: "text", help: "Livraison, Commande, Mariage…" },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "active", label: "Affichée", type: "toggle" },
      ]}
    />
  );
}

export function GalleryScreen({ items }: { items: GalleryItem[] }) {
  const cats = [
    { value: "atelier", label: "Atelier" },
    { value: "mariage", label: "Mariage" },
    { value: "evenement", label: "Événement" },
    { value: "deuil", label: "Deuil" },
    { value: "boutique", label: "Boutique" },
  ];
  return (
    <CollectionManager<GalleryItem & Record<string, unknown>>
      collection="gallery"
      title="Galerie"
      subtitle="Réalisations affichées sur l'accueil et la page Mariage"
      singular="Photo"
      items={items as (GalleryItem & Record<string, unknown>)[]}
      searchKeys={["caption"]}
      sort={(a, b) => a.sortOrder - b.sortOrder}
      filters={{ label: "Toutes les catégories", options: cats, test: (g, v) => g.category === v }}
      columns={[
        { label: "Photo", render: (g) => <Thumb src={g.image} /> },
        { label: "Légende", render: (g) => g.caption },
        { label: "Catégorie", render: (g) => <Badge>{cats.find((c) => c.value === g.category)?.label}</Badge> },
        { label: "Ordre", render: (g) => g.sortOrder },
      ]}
      defaults={{ image: "", caption: "", category: "atelier", sortOrder: items.length + 1, active: true }}
      fields={[
        { key: "image", label: "Photo", type: "image" },
        { key: "caption", label: "Légende", type: "text", span: 2 },
        { key: "category", label: "Catégorie", type: "select", options: cats },
        { key: "sortOrder", label: "Ordre", type: "number" },
        { key: "active", label: "Affichée", type: "toggle" },
      ]}
    />
  );
}

const MSG_TYPES = { contact: "Question", mariage: "Mariage", evenement: "Événement", deuil: "Deuil", entreprise: "Entreprise" };
const MSG_STATUS = { new: ["Nouveau", "bg-violet-100 text-violet-800"], read: ["Lu", "bg-sky-100 text-sky-800"], replied: ["Répondu", "bg-emerald-100 text-emerald-800"], archived: ["Archivé", "bg-neutral-200 text-neutral-600"] } as const;

export function MessagesScreen({ items }: { items: Message[] }) {
  return (
    <CollectionManager<Message & Record<string, unknown>>
      collection="messages"
      title="Messages"
      subtitle="Formulaires de contact, demandes de devis mariage, deuil et entreprise"
      singular="Message"
      items={items as (Message & Record<string, unknown>)[]}
      canCreate={false}
      toggleKey={null}
      searchKeys={["name", "email", "message", "subject"]}
      sort={(a, b) => b.createdAt.localeCompare(a.createdAt)}
      filters={{
        label: "Tous les statuts",
        options: Object.entries(MSG_STATUS).map(([value, [label]]) => ({ value, label })),
        test: (m, v) => m.status === v,
      }}
      columns={[
        {
          label: "De",
          render: (m) => (
            <span>
              <span className="block font-medium">{m.name}</span>
              <span className="text-xs text-noir/45">{m.email}</span>
            </span>
          ),
        },
        { label: "Type", render: (m) => <Badge>{MSG_TYPES[m.type]}</Badge> },
        { label: "Message", render: (m) => <span className="line-clamp-2 max-w-md text-noir/60">{m.message}</span> },
        { label: "Reçu", render: (m) => <span className="text-xs text-noir/50">{frDateTime(m.createdAt)}</span> },
        { label: "Statut", render: (m) => <Badge className={MSG_STATUS[m.status][1]}>{MSG_STATUS[m.status][0]}</Badge> },
      ]}
      defaults={{}}
      fields={[
        {
          key: "message",
          label: "Message",
          type: "custom",
          render: (_v, _set, m) => {
            const msg = m as unknown as Message;
            return (
              <div className="space-y-3 rounded-xl bg-aubergine-50/60 p-4 text-sm">
                <p className="font-medium">
                  {msg.name} · <a className="text-aubergine-700 underline" href={`mailto:${msg.email}`}>{msg.email}</a> {msg.phone && `· ${msg.phone}`}
                </p>
                {[["Date de l'événement", msg.eventDate], ["Lieu", msg.venue], ["Invités", msg.guests], ["Budget", msg.budget], ["Objet", msg.subject]]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k}>
                      <span className="text-noir/50">{k} :</span> {v}
                    </p>
                  ))}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                <a href={`mailto:${msg.email}?subject=${encodeURIComponent("Empreinte de Violettes — votre demande")}`} className="adm-btn adm-btn-primary">
                  <Mail className="h-4 w-4" /> Répondre par e-mail
                </a>
              </div>
            );
          },
        },
        {
          key: "status",
          label: "Statut",
          type: "select",
          options: Object.entries(MSG_STATUS).map(([value, [label]]) => ({ value, label })),
        },
      ]}
    />
  );
}

export function SubscribersScreen({ items }: { items: Subscriber[] }) {
  const exportCsv = () => {
    const blob = new Blob(["﻿email;date\n" + items.map((s) => `${s.email};${s.createdAt.slice(0, 10)}`).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "newsletter.csv";
    a.click();
  };
  return (
    <CollectionManager<Subscriber & Record<string, unknown>>
      collection="subscribers"
      title="Newsletter"
      subtitle={`${items.length} inscrit(s) — exportez la liste vers Brevo, Mailchimp…`}
      singular="Inscrit"
      items={items as (Subscriber & Record<string, unknown>)[]}
      toggleKey={null}
      searchKeys={["email"]}
      sort={(a, b) => b.createdAt.localeCompare(a.createdAt)}
      extraActions={
        <button onClick={exportCsv} className="adm-btn adm-btn-ghost">
          Export CSV
        </button>
      }
      columns={[
        { label: "E-mail", render: (s) => <span className="font-medium">{s.email}</span> },
        { label: "Inscrit le", render: (s) => frDateTime(s.createdAt) },
      ]}
      defaults={{ email: "" }}
      fields={[{ key: "email", label: "E-mail", type: "email", required: true, span: 2 }]}
    />
  );
}
