import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/legal/mentions-legales" } };

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="29 octobre 2026">
      <h2>Éditeur du service</h2>
      <p>Le service Waverti est édité par LULLIN WEB.</p>
      <p>Site de l'éditeur : <a href="https://www.lullin-web.com" className="text-blue underline">www.lullin-web.com</a>.</p>
      <h2>Hébergement</h2>
      <p>
        Le site et le tableau de bord sont hébergés par Vercel. La base de données PostgreSQL est exploitée par LULLIN WEB.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les éléments du site et de l'application (textes, interfaces, logo, code) sont la propriété de LULLIN WEB, sauf mention
        contraire.
      </p>
    </LegalPage>
  );
}
