import Link from 'next/link';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  showText?: boolean;
}

const sizes = {
  sm: { box: 'w-7 h-7 text-xs', text: 'text-lg' },
  md: { box: 'w-8 h-8 text-sm', text: 'text-xl' },
  lg: { box: 'w-10 h-10 text-base', text: 'text-2xl' },
};

export default function MilouLogo({ size = 'md', href = '/', showText = true }: Props) {
  const s = sizes[size];
  const mark = (
    <>
      <span
        className={`${s.box} rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shrink-0 shadow-soft`}
        aria-hidden
      >
        M
      </span>
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
