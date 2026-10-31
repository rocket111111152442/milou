import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/legal/mentions-legales" } };

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="29 octobre 2026">
      <h2>Éditeur du service</h2>
      <p>
        Le service Waverti est édité par LULLIN WEB — <Todo>forme juridique</Todo>, <Todo>capital social, le cas échéant</Todo>,
        immatriculée sous le numéro <Todo>SIREN / SIRET</Todo>, dont le siège est situé <Todo>adresse postale complète</Todo>.
      </p>
      <p>
        Numéro de TVA intracommunautaire : <Todo>numéro de TVA ou mention d'exonération</Todo>. Contact : <Todo>adresse e-mail et
        téléphone</Todo>. Site de l'éditeur : <a href="https://www.lullin-web.com" className="text-blue underline">www.lullin-web.com</a>.
      </p>
      <h2>Directeur de la publication</h2>
      <p>
        <Todo>nom et qualité du directeur de la publication</Todo>.
      </p>
      <h2>Hébergement</h2>
      <p>
        Site et tableau de bord : Vercel Inc., <Todo>adresse de l'hébergeur à vérifier sur le contrat</Todo>. Base de données et
        authentification : serveur PostgreSQL exploité par LULLIN WEB, <Todo>hébergeur, région (UE) et adresse du serveur de base de données</Todo>. Serveurs de
        surveillance : OVHcloud, <Todo>adresse et localisation du serveur</Todo>.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Les éléments du site et de l'application (textes, interfaces, logo, code) sont la propriété de LULLIN WEB, sauf mention
        contraire. Le logo actuellement affiché est provisoire.
      </p>
    </LegalPage>
  );
}
