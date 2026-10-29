import Link from "next/link";
import { Button, Logo } from "@watchly/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Logo />
        <p className="font-display text-7xl font-extrabold tracking-tight">404</p>
        <h1 className="font-display text-2xl font-bold">Cette page est introuvable</h1>
        <p className="text-muted-fg">Watchly a cherché partout, sans succès. Vérifiez l'adresse ou revenez à l'accueil.</p>
        <Button asChild>
          <Link href="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </main>
  );
}
