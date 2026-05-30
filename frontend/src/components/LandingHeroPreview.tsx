export default function LandingHeroPreview() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none animate-float">
      <div className="absolute -inset-4 bg-indigo-500/10 rounded-3xl blur-2xl" aria-hidden />
      <div className="relative rounded-2xl border border-white/10 bg-milou-surface shadow-card overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-milou-card/80">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-2 text-xs text-zinc-500 font-medium">milou.app/marketplace</span>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Balance strip */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Votre solde</p>
              <p className="text-2xl font-bold text-white tabular-nums">
                10<span className="text-emerald-400">.00</span>
                <span className="text-sm font-medium text-zinc-400 ml-1">M</span>
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Gratuit
            </span>
          </div>

          {/* Mock listings */}
          <div className="space-y-2.5">
            {[
              { title: 'Logo pour association', price: '8', cat: 'Design', type: 'Offre' },
              { title: 'Aide Python débutant', price: '5', cat: 'Dev', type: 'Demande' },
              { title: 'Relecture mémoire', price: '12', cat: 'Rédaction', type: 'Offre' },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between p-3 rounded-xl bg-milou-card border border-white/[0.06] hover:border-indigo-500/20 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {item.type} · {item.cat}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-400 tabular-nums shrink-0 ml-3">
                  {item.price} M
                </span>
              </div>
            ))}
          </div>

          {/* Mission status */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-milou-card/60">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white">Mission en cours</p>
              <p className="text-[11px] text-zinc-500 truncate">Escrow actif · Chat ouvert</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
