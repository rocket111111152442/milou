import Link from 'next/link';
import Image from 'next/image';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  showText?: boolean;
}

const LOGO_SRC = '/milou-logo.svg';

const sizes = {
  sm: { px: 28, text: 'text-lg' },
  md: { px: 32, text: 'text-xl' },
  lg: { px: 40, text: 'text-2xl' },
};

/** Icône seule (chargement, etc.) */
export function MilouLogoMark({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { px } = sizes[size];
  return (
    <Image
      src={LOGO_SRC}
      alt=""
      width={px}
      height={px}
      className={`shrink-0 ${className}`}
      aria-hidden
      unoptimized
    />
  );
}

export default function MilouLogo({ size = 'md', href = '/', showText = true }: Props) {
  const s = sizes[size];
  const mark = (
    <>
      <MilouLogoMark size={size} />
      {showText && (
        <span className={`${s.text} font-bold tracking-tight text-white`}>MILOU</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center gap-2.5 hover:opacity-90 transition">
        {mark}
      </Link>
    );
  }

  return <span className="inline-flex items-center gap-2.5">{mark}</span>;
}
