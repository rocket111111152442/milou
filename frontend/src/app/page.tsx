import Image from 'next/image';
import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';

const STATS = [
  { value: '100%', label: 'Gratuit' },
  { value: '10 M', label: 'Offerts à l\'inscription' },
  { value: '0 €', label: 'Argent réel' },
  { value: '24/7', label: 'Plateforme en ligne' },
];

const REASONS = [
  {
    title: 'Zéro frais, zéro carte bancaire',
    desc: 'MILOU est entièrement gratuit. Pas d\'abonnement, pas de commission cachée, pas de paiement en euros. Seule la monnaie fictive Milou circule entre les membres.',
    icon: '🎁',
  },
  {
    title: '10 Milou pour bien démarrer',
    desc: 'Dès votre inscription, vous recevez 10 Milou sur votre compte. Assez pour tester le marketplace, envoyer un transfert ou accepter une première mission.',
    icon: '✨',
  },
  {
    title: 'Économie locale et solidaire',
    desc: 'Échangez des compétences entre particuliers : design, dev, cours, aide administrative… Vous valorisez votre temps sans sortir votre portefeuille.',
    icon: '🤝',
  },
  {
    title: 'Sécurisé et transparent',
    desc: 'Escrow intégré : les Milou sont bloqués jusqu\'à validation de la mission. Chat par mission, historique complet, profil avec réputation.',
    icon: '🔒',
  },
];

const FEATURES = [
  {
    title: 'Marketplace de services',
    desc: 'Publiez une offre (« je propose ») ou une demande (« je cherche »). Filtrez par catégorie, consultez les prix en Milou et acceptez en un clic.',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0a32e7?w=800&q=80',
    alt: 'Personnes collaborant sur un projet',
  },
  {
    title: 'Transferts entre membres',
    desc: 'Envoyez des Milou à un autre utilisateur par e-mail. Idéal pour remercier, régler entre amis virtuels ou compléter un échange.',
    image: 'https://images.unsplash.com/photo-1639765487017-dba89fcad2e1?w=800&q=80',
    alt: 'Visualisation technologique finance',
  },
  {
    title: 'Chat & missions',
    desc: 'Quand une mission démarre, ouvrez un fil de discussion dédié. Badge rouge si nouveau message — vous ne ratez rien.',
    image: 'https://images.unsplash.com/photo-1577563908411-5077b57dcad4?w=800&q=80',
    alt: 'Discussion sur mobile',
  },
];

const STEPS = [
  { n: '01', title: 'Créez votre compte', desc: 'Inscription gratuite en 30 secondes. 10 Milou crédités automatiquement.' },
  { n: '02', title: 'Explorez ou publiez', desc: 'Parcourez le marketplace ou déposez votre annonce avec prix et délai.' },
  { n: '03', title: 'Échangez en confiance', desc: 'Escrow + chat : les Milou sont libérés quand la mission est validée.' },
];

const CATEGORIES = ['Design', 'Développement', 'Rédaction', 'Coaching', 'Aide & services', 'Autre'];

export default function HomePage() {
  return (
    <main className="landing-page min-h-screen bg-milou-bg text-gray-100">
      <LandingHeader />

      {/* Hero — vertical mobile, 2 colonnes desktop */}
      <section className="relative overflow-hidden border-b border-milou-border">
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80"
            alt=""
            fill
            className="object-cover opacity-25"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-milou-bg/40 via-milou-bg/85 to-milou-bg" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24 landing-hero-grid landing-mobile-center lg:text-left">
          <div className="flex flex-col lg:items-start">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30 mb-4 sm:mb-6">
              100 % gratuit — monnaie 100 % fictive
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight max-w-3xl">
              L&apos;économie virtuelle
              <span className="block bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                qui relie les talents
              </span>
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-gray-300 max-w-2xl leading-relaxed">
              MILOU est une plateforme communautaire où vous échangez des services avec la monnaie
              fictive <strong className="text-cyan-400">Milou</strong>. Aucun euro en jeu : uniquement
              une économie interne pour apprendre, aider et collaborer.
            </p>
            <div className="landing-actions mt-8 sm:mt-10 flex flex-col w-full sm:w-auto sm:flex-row gap-3 sm:gap-4">
              <Link href="/register" className="btn-primary text-center text-base sm:text-lg px-6 sm:px-8 py-3.5 w-full sm:w-auto">
                Créer un compte — 10 Milou
              </Link>
              <Link href="/marketplace" className="btn-secondary text-center text-base sm:text-lg px-6 sm:px-8 py-3.5 w-full sm:w-auto">
                Voir le marketplace
              </Link>
            </div>
            <p className="mt-4 text-xs sm:text-sm text-gray-500">
              Pas de carte bancaire · Inscription en moins d&apos;une minute
            </p>
          </div>

          <div className="relative w-full max-w-md mx-auto lg:max-w-none aspect-[3/4] sm:aspect-[4/3] lg:aspect-square rounded-2xl overflow-hidden border border-milou-border shadow-neon">
            <Image
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80"
              alt="Équipe collaborant ensemble"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Stats — 2x2 vertical mobile, 4 colonnes horizontal desktop */}
      <section className="border-b border-milou-border bg-milou-card/50">
        <div className="landing-stats max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center py-2">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-cyan-400">{s.value}</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pourquoi — image au-dessus sur mobile, côte à côte sur desktop */}
      <section id="pourquoi" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
        <div className="card overflow-hidden flex flex-col lg:grid lg:grid-cols-2 gap-0 p-0">
          <div className="relative w-full aspect-[16/10] sm:aspect-[2/1] lg:aspect-auto lg:min-h-[320px]">
            <Image
              src="https://images.unsplash.com/photo-1529139578326-5691f77d3066?w=800&q=80"
              alt="Communauté de personnes"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-milou-card/80 via-transparent to-transparent lg:from-transparent lg:to-milou-card" />
          </div>
          <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4 text-center lg:text-left">
              Pourquoi rejoindre MILOU ?
            </h2>
            <p className="text-gray-400 mb-5 sm:mb-6 leading-relaxed text-sm sm:text-base text-center lg:text-left">
              Vous cherchez une façon d&apos;échanger des services sans dépenser d&apos;argent réel ?
              MILOU a été conçu pour les étudiants, créatifs, développeurs et curieux qui veulent
              une <strong className="text-white">économie de jeu sérieuse</strong> sans risque financier.
            </p>
            <ul className="space-y-2 sm:space-y-3">
              {[
                'Plateforme 100 % gratuite, pour toujours',
                'Aucun retrait en euros — Milou n\'a pas de valeur réelle',
                'Marketplace, transferts, escrow et chat inclus',
                'Réputation et historique pour des échanges clairs',
              ].map((item) => (
                <li key={item} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-green-400 shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 sm:mt-8 landing-portrait-only">
          {REASONS.map((r) => (
            <div key={r.title} className="card hover:border-cyan-500/30 transition">
              <span className="text-2xl">{r.icon}</span>
              <h3 className="font-semibold text-white mt-3 mb-2">{r.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fonctionnalités — vertical mobile, image + texte horizontal desktop */}
      <section id="fonctionnalites" className="bg-milou-card/30 border-y border-milou-border py-12 sm:py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-cyan-400 text-sm font-medium uppercase tracking-wider text-center">Fonctionnalités</p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mt-2 mb-3 sm:mb-4 px-2">
            Tout pour échanger sereinement
          </h2>
          <p className="text-gray-400 text-center text-sm sm:text-base max-w-2xl mx-auto mb-10 sm:mb-14 px-2">
            Un tableau de bord clair, une monnaie virtuelle et des outils pensés pour des missions
            entre particuliers.
          </p>

          <div className="space-y-12 sm:space-y-16">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`landing-row ${i % 2 === 1 ? 'landing-row-reverse' : ''}`}
              >
                <div className="relative w-full aspect-[4/3] sm:aspect-video lg:aspect-[4/3] rounded-xl overflow-hidden border border-milou-border shadow-neon lg:flex-1">
                  <Image
                    src={f.image}
                    alt={f.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 45vw"
                  />
                </div>
                <div className="lg:flex-1 text-center lg:text-left px-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">{f.title}</h3>
                  <p className="text-gray-400 text-sm sm:text-base leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-center mb-6 sm:mb-8 px-2">
          Des services dans toutes les catégories
        </h2>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="px-4 py-2.5 rounded-full bg-milou-card border border-milou-border text-sm text-gray-300"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="text-center text-gray-500 text-xs sm:text-sm mt-6 sm:mt-8 max-w-xl mx-auto px-2">
          Publiez une offre ou répondez à une demande. Vous fixez le prix en Milou et le délai estimé.
        </p>
      </section>

      {/* Étapes — 1 colonne mobile, 3 colonnes desktop */}
      <section id="comment" className="border-t border-milou-border bg-gradient-to-b from-milou-bg to-milou-card/40 py-12 sm:py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-14">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="card text-center relative">
                <span className="text-4xl sm:text-5xl font-bold text-cyan-500/20 absolute top-4 right-4">{s.n}</span>
                <h3 className="text-lg sm:text-xl font-semibold text-cyan-400 mb-2 relative">{s.title}</h3>
                <p className="text-gray-400 text-sm relative">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avertissement */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="card border-violet-500/30 bg-violet-500/5 p-6 sm:p-8 lg:p-10 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Important à savoir</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            <strong className="text-white">Milou n&apos;est pas une cryptomonnaie</strong> et ne peut
            pas être converti en euros. C&apos;est une monnaie de jeu pédagogique et communautaire.
            MILOU reste <strong className="text-green-400">100 % gratuit</strong> : pas de vente de
            Milou, pas de microtransactions, pas d&apos;argent réel.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-milou-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(167,139,250,0.12)_0%,_transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center landing-mobile-center">
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2">
            Prêt à rejoindre l&apos;économie Milou ?
          </h2>
          <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto px-2">
            Rejoignez la communauté gratuitement. Vos 10 Milou vous attendent.
          </p>
          <Link href="/register" className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 inline-block w-full max-w-sm sm:w-auto">
            S&apos;inscrire gratuitement
          </Link>
        </div>
      </section>

      {/* Footer — vertical mobile, horizontal desktop */}
      <footer className="border-t border-milou-border py-8 sm:py-10 bg-milou-card/30 safe-bottom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row justify-between items-center gap-6 text-center lg:text-left">
          <div>
            <p className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              MILOU
            </p>
            <p className="text-gray-500 text-sm mt-1">Économie virtuelle · 100 % gratuit</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-6 text-sm text-gray-400">
            <Link href="/marketplace" className="hover:text-cyan-400">Marketplace</Link>
            <Link href="/login" className="hover:text-cyan-400">Connexion</Link>
            <Link href="/register" className="hover:text-cyan-400">Inscription</Link>
          </div>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6 sm:mt-8 px-4">
          © {new Date().getFullYear()} MILOU — Plateforme fictive. Aucune monnaie réelle impliquée.
          Photos : Unsplash.
        </p>
      </footer>
    </main>
  );
}
