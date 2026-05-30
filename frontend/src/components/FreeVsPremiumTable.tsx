import { PREMIUM_FEATURES } from '@/lib/premium/config';

export default function FreeVsPremiumTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-milou-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-milou-bg border-b border-milou-border">
            <th className="text-left p-4 text-gray-400 font-medium">Fonctionnalité</th>
            <th className="p-4 text-center text-gray-300">Gratuit</th>
            <th className="p-4 text-center text-amber-300 bg-amber-500/5">Premium</th>
          </tr>
        </thead>
        <tbody>
          {PREMIUM_FEATURES.map((f) => (
            <tr key={f.id} className="border-b border-milou-border/50 hover:bg-white/[0.02]">
              <td className="p-4 text-gray-300">{f.label}</td>
              <td className="p-4 text-center text-gray-500">
                {typeof f.free === 'boolean' ? (f.free ? '✓' : '—') : f.free}
              </td>
              <td className="p-4 text-center text-amber-200 font-medium bg-amber-500/5">
                {typeof f.premium === 'boolean' ? (f.premium ? '✓' : '—') : f.premium}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
