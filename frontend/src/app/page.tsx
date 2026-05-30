import Link from 'next/link';
import LandingHeader from '@/components/LandingHeader';
import LandingHeroPreview from '@/components/LandingHeroPreview';
import { IconArrowRight, IconCheck, IconChat, IconCoins, IconLock, IconShield, IconStore } from '@/components/ui/Icons';
import MilouLogo from '@/components/ui/MilouLogo';

const STATS = [
  { value: '100%', label: 'Gratuit' },
  { value: '10 M', label: 'Offerts à l\'inscription' },
  { value: '0 €', label: 'Argent réel' },
  { value: 'Escrow', label: 'Paiements sécurisés' },
];

const REASONS = [
  {
    title: 'Zéro frais, zéro carte',
    desc: 'Pas d\'abonnement obligatoire, pas de commission cachée. Seule la monnaie fictive Milou circule entre les membres.',
    icon: IconCoins,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: '10 Milou pour démarrer',
    desc: 'Crédités dès l\'inscription. Assez pour tester le marketplace, envoyer un transfert ou lancer une première mission.',
    icon: IconStore,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    title: 'Économie entre particuliers',
    desc: 'Design, dev, cours, aide admin… Valorisez votre temps et vos compétences sans sortir votre portefeuille.',
    icon: IconChat,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    title: 'Escrow intégré',
    desc: 'Les Milou sont bloqués jusqu\'à validation. Chat par mission, historique complet, profil avec réputation.',
    icon: IconLock,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
];

const FEATURES = [
  {
    title: 'Marketplace de services',
    desc: 'Publiez une offre ou une demande. Filtrez par catégorie, consultez les prix en Milou et acceptez en un clic.',
    icon: IconStore,
  },
  {
    title: 'Transferts entre membres',
    desc: 'Envoyez des Milou par e-mail avec double vérification. Idéal pour remercier ou compléter un échange.',
    icon: IconCoins,
  },
  {
    title: 'Chat & missions',
    desc: 'Fil de discussion dédié par mission, pièces jointes, notifications. Vous ne ratez rien.',
    icon: IconChat,
  },
];

const STEPS = [
  { n: '1', title: 'Créez votre compte', desc: 'Inscription gratuite en moins d\'une minute. 10 Milou crédités automatiquement.' },
  { n: '2', title: 'Explorez ou publiez', desc: 'Parcourez le marketplace ou déposez votre annonce avec prix et délai.' },
  { n: '3', title: 'Échangez en confiance', desc: 'Escrow + chat : les Milou sont libérés quand la mission est validée.' },
];

const CATEGORIES = ['Design', 'Développement', 'Rédaction', 'Coaching', 'Aide & services', 'Autre'];

const TRUST = [
  'Monnaie 100 % fictive',
  'Escrow sur chaque mission',
  'Profils avec réputation',
  'Support modération',
];

export default function HomePage() {
  return (
    <main className="landing-page min-h-screen bg-milou-bg">
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06] landing-mesh">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 lg:py-28 landing-hero-grid landing-mobile-center">
          <div className="animate-fade-up">
            <div className="flex flex-wrap gap-2 mb-6 justify-center lg:justify-start">
              <span className="trust-badge">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Gratuit · Sans argent réel
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] max-w-xl mx-auto lg:mx-0">
              Échangez des services.
              <span className="block text-indigo-400 mt-1">Payez en Milou.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-lg leading-relaxed mx-auto lg:mx-0">
              MILOU est la marketplace communautaire où vous troquez des compétences via une monnaie
              virtuelle. Aucun euro en jeu — juste une économie interne pour apprendre, aider et
              collaborer.
            </p>
            <div className="landing-actions mt-8">
              <Link href="/register" className="btn-primary text-base px-7 py-3 w-full sm:w-auto">
                Commencer gratuitement
                <IconArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/marketplace" className="btn-secondary text-base px-7 py-3 w-full sm:w-auto">
                Découvrir la plateforme
              </Link>
            </div>
            <p className="mt-5 text-xs text-zinc-600">
              Pas de carte bancaire · 10 Milou offerts · Inscription en 30 secondes
            </p>
          </div>

          <div className="animate-fade-up stagger-2">
            <LandingHeroPreview />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-white/[0.06] bg-milou-surface/50">
        <div className="landing-stats max-w-6xl mx-auto px-4 sm:px-6 py-10">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`text-center py-2 animate-fade-up stagger-${i + 1}`}
            >
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust bar */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {TRUST.map((t) => (
            <span key={t} className="trust-badge">
              <IconShield className="w-3.5 h-3.5 text-indigo-400" />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Pourquoi */}
      <section id="pourquoi" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="section-label">Pourquoi MILOU</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">
            Une économie de compétences, sans risque financier
          </h2>
          <p className="text-zinc-400 mt-4 leading-relaxed">
            Pour les étudiants, créatifs et développeurs qui veulent échanger des services sans
            dépenser d&apos;argent réel.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {REASONS.map((r) => (
            <div key={r.title} className="card-interactive group">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${r.color}`}>
                <r.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white mb-2">{r.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        <ul className="mt-10 grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
          {[
            'Plateforme gratuite, sans limite de durée',
            'Aucun retrait en euros possible',
            'Marketplace, transferts, escrow et chat',
            'Réputation et historique transparents',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
              <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="border-y border-white/[0.06] bg-milou-surface/30 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="section-label">Fonctionnalités</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">
              Tout pour échanger sereinement
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-interactive">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-8">
          Des services dans toutes les catégories
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className="px-4 py-2 rounded-xl bg-milou-card border border-white/[0.06] text-sm text-zinc-300 hover:border-indigo-500/30 transition"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* Étapes */}
      <section id="comment" className="border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="section-label">Comment ça marche</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">Trois étapes, c&apos;est parti</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="card relative overflow-hidden">
                <span className="absolute top-4 right-4 text-5xl font-bold text-white/[0.04] select-none">
                  {s.n}
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center justify-center mb-4">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avertissement */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="card border-indigo-500/20 bg-indigo-500/5 text-center max-w-3xl mx-auto">
          <h2 className="text-lg font-semibold text-white mb-2">Important à savoir</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            <strong className="text-white">Milou n&apos;est pas une cryptomonnaie</strong> et ne peut
            pas être converti en euros. C&apos;est une monnaie de jeu pédagogique et communautaire.
            MILOU reste <strong className="text-emerald-400">100 % gratuit</strong>.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-white/[0.06] landing-mesh">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight max-w-2xl mx-auto">
            Prêt à rejoindre l&apos;économie Milou ?
          </h2>
          <p className="text-zinc-400 mt-4 mb-8 max-w-md mx-auto">
            Rejoignez la communauté gratuitement. Vos 10 Milou vous attendent.
          </p>
          <Link href="/register" className="btn-primary text-base px-8 py-3.5 inline-flex">
            S&apos;inscrire gratuitement
            <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 bg-milou-surface/40 safe-bottom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <MilouLogo size="sm" href="/" />
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
            <Link href="/marketplace" className="hover:text-white transition">
              Marketplace
            </Link>
            <Link href="/login" className="hover:text-white transition">
              Connexion
            </Link>
            <Link href="/register" className="hover:text-white transition">
              Inscription
            </Link>
          </div>
        </div>
        <p className="text-center text-zinc-600 text-xs mt-8 px-4">
          © {new Date().getFullYear()} MILOU — Plateforme fictive. Aucune monnaie réelle impliquée.
        </p>
      </footer>
    </main>
  );
}
