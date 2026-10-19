"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSite, resetSitePassword } from "./actions";

export function accessMessage(name: string, siteUrl: string, adminUrl: string, password?: string) {
  return `Bonjour,\n\nVoici le site de ${name} :\n${siteUrl}\n\nEspace pour gérer les commandes, les prix et les produits :\n${adminUrl}${password ? `\nMot de passe : ${password}` : ""}\n\nVous pouvez tout modifier vous-même depuis cet espace (produits, prix, photos, fermetures, notifications de commandes).`;
}

export function SiteCard({
  origin,
  slug,
  name,
  kind,
  cities,
  productCount,
  createdAt,
  swatch,
}: {
  origin: string;
  slug: string;
  name: string;
  kind: string;
  cities: string[];
  productCount: number;
  createdAt: string;
  swatch: string[];
}) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const siteUrl = `${origin}/s/${slug}`;
  const adminUrl = `${siteUrl}/admin`;

  if (gone) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez le texte :", text);
    }
  };

  return (
    <li className="rounded-[1.75rem] bg-creme p-6 ring-1 ring-mie">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-grege">
            {kind} · {cities.join(", ")}
          </p>
          <h2 className="truncate font-display text-2xl">{name}</h2>
          <p className="mt-1 truncate text-sm text-grege">/s/{slug}</p>
        </div>
        <span className="mt-1 flex shrink-0 -space-x-1.5" aria-hidden="true">
          {swatch.map((c) => (
            <span key={c} className="h-6 w-6 rounded-full ring-2 ring-creme" style={{ background: c }} />
          ))}
        </span>
      </div>
      <p className="mt-2 text-xs text-grege">
        {productCount} produits · créé le {new Date(createdAt).toLocaleDateString("fr-FR")}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full bg-cafe px-5 text-sm font-semibold text-creme transition hover:bg-croute">
          Voir le site ↗
        </a>
        <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full border border-mie px-4 text-sm font-semibold transition hover:bg-mie">
          Espace boutiques ↗
        </a>
        <Link href={`/studio/${slug}`} className="inline-flex h-10 items-center rounded-full border border-mie px-4 text-sm font-semibold transition hover:bg-mie">
          Modifier
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-mie pt-3 text-sm">
        <button type="button" onClick={() => copy(siteUrl)} className="font-semibold text-croute hover:underline">
          {copied ? "Copié ✓" : "Copier le lien"}
        </button>
        <span className="text-mie">·</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Générer un nouveau mot de passe pour l'espace boutiques ? L'ancien ne fonctionnera plus.")) return;
            start(async () => {
              const r = await resetSitePassword(slug);
              setMsg(r.ok ? accessMessage(name, siteUrl, adminUrl, r.password) : r.error);
            });
          }}
          className="font-semibold text-croute hover:underline disabled:opacity-50"
        >
          Nouveau mot de passe + message
        </button>
        <span className="text-mie">·</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Supprimer définitivement « ${name} » (site, commandes, réglages, photos) ? Cette action est irréversible.`)) return;
            start(async () => {
              const r = await deleteSite(slug);
              if (r.ok) setGone(true);
              else setMsg(r.error ?? "Échec de la suppression");
            });
          }}
          className="font-semibold text-red-700 hover:underline disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>

      {msg && (
        <div className="mt-4 rounded-2xl bg-farine p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm">{msg}</pre>
          <button type="button" onClick={() => copy(msg)} className="mt-3 h-9 rounded-full bg-croute px-4 text-sm font-semibold text-creme transition hover:bg-cafe">
            {copied ? "Copié ✓" : "Copier le message"}
          </button>
        </div>
      )}
    </li>
  );
}
