import { PREMIUM_FEATURES } from '@/lib/premium/config';

export default function FreeVsPremiumTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-milou-surface border-b border-white/[0.06]">
            <th className="text-left p-4 text-zinc-500 font-medium">Fonctionnalité</th>
            <th className="p-4 text-center text-zinc-300">Gratuit</th>
            <th className="p-4 text-center text-amber-300 bg-amber-500/5">Premium</th>
          </tr>
        </thead>
        <tbody>
          {PREMIUM_FEATURES.map((f) => (
            <tr key={f.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
              <td className="p-4 text-zinc-300">{f.label}</td>
              <td className="p-4 text-center text-zinc-500">
                {typeof f.free === 'boolean' ? (f.free ? '✓' : '—') : f.free}
              </td>
              <td className="p-4 text-center text-amber-200/90 font-medium bg-amber-500/5">
                {typeof f.premium === 'boolean' ? (f.premium ? '✓' : '—') : f.premium}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
