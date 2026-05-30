import { MILOU_EXAMPLES } from '@/lib/landing-examples';

export default function LandingHeroPreview() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      <div className="absolute -inset-6 bg-indigo-500/15 rounded-[2rem] blur-3xl animate-pulse-slow" aria-hidden />
      <div className="relative rounded-2xl border border-white/10 bg-milou-surface shadow-card overflow-hidden animate-float">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-milou-card/80">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-2 text-xs text-zinc-500 font-medium">Marketplace MILOU</span>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Bonus inscription</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                10<span className="text-emerald-400">.00</span>
                <span className="text-sm font-medium text-zinc-400 ml-1">M</span>
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-medium">
              Gratuit
            </span>
          </div>

          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Exemples du marketplace</p>

          <div className="space-y-2">
            {MILOU_EXAMPLES.map((item) => (
              <div
                key={item.service}
                className={`flex items-center justify-between p-3 rounded-xl bg-milou-card border ${item.border}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.service}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.category}</p>
                </div>
                <span className={`text-lg font-black tabular-nums shrink-0 ml-3 ${item.priceColor}`}>
                  {item.price} M
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/25 flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white">Mission acceptée</p>
              <p className="text-[11px] text-zinc-500">Milou bloqués en escrow · Chat ouvert</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
