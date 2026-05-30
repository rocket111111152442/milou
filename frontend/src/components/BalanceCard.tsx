export default function BalanceCard({ balance, label = 'Solde Milou' }: { balance: number; label?: string }) {
  return (
    <div className="card relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <p className="text-zinc-500 text-sm font-medium">{label}</p>
      <p className="text-4xl md:text-5xl font-bold text-white tabular-nums mt-1 tracking-tight">
        {balance.toFixed(2)}
        <span className="text-xl md:text-2xl text-emerald-400 ml-1 font-semibold">M</span>
      </p>
      <p className="text-zinc-600 text-xs mt-2">Monnaie virtuelle · sans valeur réelle</p>
    </div>
  );
}
