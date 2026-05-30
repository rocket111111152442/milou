import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/Icons';
import { COMMUNITY_AVATARS, LANDING_SOCIAL_PROOF } from '@/lib/landing-examples';

interface Props {
  compact?: boolean;
  showCta?: boolean;
}

export default function LandingCommunityBanner({ compact, showCta }: Props) {
  return (
    <div
      className={`rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-milou-card to-emerald-500/5
        ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6 lg:p-7'}`}
    >
      <div className={`flex flex-col ${compact ? 'gap-4' : 'sm:flex-row sm:items-center gap-5 sm:gap-8'}`}>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex -space-x-2.5">
            {COMMUNITY_AVATARS.map((a) => (
              <span
                key={a.initials}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full ${a.color} border-2 border-milou-bg
                  flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-soft`}
                aria-hidden
              >
                {a.initials}
              </span>
            ))}
            <span
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-milou-elevated border-2 border-milou-bg
                flex items-center justify-center text-[10px] font-bold text-zinc-300"
              aria-hidden
            >
              +2k
            </span>
          </div>
          <div className="sm:hidden">
            <p className="text-2xl font-bold text-white tabular-nums">{LANDING_SOCIAL_PROOF.memberCount}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{LANDING_SOCIAL_PROOF.memberLabel}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {LANDING_SOCIAL_PROOF.activeLabel}
          </p>
          <h2 className={`font-bold text-white tracking-tight leading-snug ${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl lg:text-2xl'}`}>
            {LANDING_SOCIAL_PROOF.headline}
          </h2>
          <p className={`text-zinc-400 mt-1.5 leading-relaxed ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
            {LANDING_SOCIAL_PROOF.subline}
          </p>
          {!compact && (
            <p className="text-xs text-zinc-500 mt-2">{LANDING_SOCIAL_PROOF.ctaHint}</p>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-center shrink-0 px-2">
          <p className="text-3xl lg:text-4xl font-black text-white tabular-nums">{LANDING_SOCIAL_PROOF.memberCount}</p>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider text-center mt-0.5 max-w-[5rem] leading-tight">
            {LANDING_SOCIAL_PROOF.memberLabel}
          </p>
        </div>

        {showCta && (
          <Link href="/register" className="btn-primary shrink-0 w-full sm:w-auto justify-center text-sm">
            Rejoindre
            <IconArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function SocialProofLines({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs sm:text-sm text-zinc-400 leading-relaxed ${className}`}>
      <span className="text-zinc-300 font-medium">{LANDING_SOCIAL_PROOF.headline}.</span>
      <span className="block text-zinc-500 mt-1">{LANDING_SOCIAL_PROOF.ctaHint}</span>
    </p>
  );
}
