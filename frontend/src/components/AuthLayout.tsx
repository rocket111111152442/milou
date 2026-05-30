import Link from 'next/link';
import MilouLogo from '@/components/ui/MilouLogo';
import { IconCheck } from '@/components/ui/Icons';

const perks = [
  '10 Milou offerts à l\'inscription',
  'Aucune carte bancaire requise',
  'Marketplace et chat inclus',
];

export default function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-white/[0.06] landing-mesh">
        <MilouLogo size="lg" />
        <div className="max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            La marketplace où l&apos;on paie en compétences, pas en euros.
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            MILOU connecte des personnes qui veulent échanger des services via une monnaie
            virtuelle sécurisée. Simple, gratuit, sans risque financier.
          </p>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <IconCheck className="w-3 h-3 text-emerald-400" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-zinc-600">
          Milou n&apos;a aucune valeur réelle · Monnaie fictive communautaire
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="lg:hidden mb-8">
          <MilouLogo size="md" />
        </div>
        <div className="auth-panel">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-zinc-400 text-sm mt-1 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </div>
        <p className="mt-6 text-xs text-zinc-600 text-center max-w-sm">
          En continuant, vous acceptez que MILOU utilise une monnaie fictive sans conversion en euros.
        </p>
        <Link href="/" className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition">
          ← Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
