import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-milou-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            MILOU
          </span>
          <div className="flex gap-3">
            <Link href="/login" className="btn-secondary text-sm">Connexion</Link>
            <Link href="/register" className="btn-primary text-sm">S&apos;inscrire</Link>
          </div>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,211,238,0.08)_0%,_transparent_70%)]" />
        <h1 className="text-4xl md:text-6xl font-bold mb-6 relative">
          L&apos;économie virtuelle
          <br />
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            entre particuliers
          </span>
        </h1>
        <p className="text-gray-400 max-w-xl mb-10 text-lg relative">
          Échangez des services avec la monnaie fictive <strong className="text-cyan-400">Milou</strong>.
          Marketplace, transferts, escrow — sans argent réel.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 relative">
          <Link href="/register" className="btn-primary text-lg px-8 py-3">
            Commencer — 10 Milou offerts
          </Link>
          <Link href="/marketplace" className="btn-secondary text-lg px-8 py-3">
            Explorer le marketplace
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-4xl w-full relative">
          {[
            { title: 'Monnaie Milou', desc: '10 Milou à l\'inscription, transferts sécurisés' },
            { title: 'Marketplace', desc: 'Offres et demandes de services entre utilisateurs' },
            { title: 'Escrow simple', desc: 'Paiement bloqué jusqu\'à validation de la mission' },
          ].map((f) => (
            <div key={f.title} className="card text-left">
              <h3 className="text-cyan-400 font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-milou-border py-6 text-center text-gray-500 text-sm">
        MILOU — Plateforme fictive · Aucune monnaie réelle
      </footer>
    </main>
  );
}
