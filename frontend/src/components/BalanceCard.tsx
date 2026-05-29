export default function BalanceCard({ balance, label = 'Solde Milou' }: { balance: number; label?: string }) {
  return (
    <div className="card relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
        {balance.toFixed(2)}
      </p>
      <p className="text-cyan-500/80 text-sm mt-1">Milou — monnaie virtuelle</p>
    </div>
  );
}
