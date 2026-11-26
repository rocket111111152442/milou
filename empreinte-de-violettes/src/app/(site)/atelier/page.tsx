import { redirect } from "next/navigation";

// La composition de bouquet sur mesure est retirée du site : l'ancienne adresse mène à la boutique.
// (Le composant Composer reste dans src/components/shop pour pouvoir la réactiver.)
export default function AtelierPage() {
  redirect("/boutique");
}
