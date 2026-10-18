"use client";

import { useState, useTransition } from "react";
import { resetAll } from "../actions";

export function ResetAll() {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () => {
    if (!confirm("Tout effacer définitivement ? Cette action est irréversible.")) return;
    setMessage(null);
    start(async () => {
      try {
        const r = await resetAll(text);
        setText("");
        setMessage({ ok: true, text: `Remise à zéro faite : ${r.orders} commande(s), ${r.photos} photo(s) et ${r.devices} appareil(s) supprimés, réglages d'origine rétablis.` });
      } catch (e) {
        setMessage({ ok: false, text: `Échec : ${(e as Error).message}` });
      }
    });
  };

  return (
    <section className="mt-12 rounded-[1.5rem] border border-red-200 bg-red-50/60 p-6">
      <h2 className="font-display text-2xl text-red-800">Remise à zéro</h2>
      <p className="mt-2 max-w-2xl text-sm text-cafe/80">
        Supprime définitivement <strong>toutes les commandes</strong>, les produits ajoutés et leurs photos, les prix
        modifiés, les fermetures, les appareils qui reçoivent les notifications, et repasse les deux boutiques en mode
        démonstration. Le site revient à son état de départ.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Tapez <strong>EFFACER</strong> pour confirmer :
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            className="h-10 w-36 rounded-xl border border-red-200 bg-creme px-3 font-semibold uppercase outline-none focus:ring-4 focus:ring-red-100"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={text !== "EFFACER" || pending}
          className="h-10 rounded-full bg-red-700 px-5 text-sm font-semibold text-creme transition hover:bg-red-800 disabled:opacity-40"
        >
          {pending ? "Suppression…" : "Tout effacer"}
        </button>
      </div>
      {message && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.ok ? "bg-olive/15 text-olive" : "bg-red-100 text-red-800"}`}>{message.text}</p>}
    </section>
  );
}
