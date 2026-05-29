import { Transaction } from '@/lib/types';

const typeLabels: Record<string, string> = {
  registration: 'Inscription',
  transfer: 'Transfert',
  service_payment: 'Service',
  escrow_hold: 'Escrow (blocage)',
  escrow_release: 'Escrow (libération)',
  admin_adjustment: 'Ajustement admin',
};

export default function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) {
    return <p className="text-gray-500 text-sm">Aucune transaction pour le moment.</p>;
  }

  return (
    <ul className="space-y-2 max-h-96 overflow-y-auto">
      {transactions.map((tx) => {
        const isIncoming = tx.toUserId && typeof tx.toUserId === 'object';
        const sign = tx.type === 'escrow_hold' ? '−' : '+';
        return (
          <li
            key={tx._id}
            className="flex items-center justify-between p-3 rounded-lg bg-milou-bg border border-milou-border text-sm"
          >
            <div>
              <span className="badge bg-cyan-500/10 text-cyan-400 mr-2">
                {typeLabels[tx.type] || tx.type}
              </span>
              <span className="text-gray-400">
                {new Date(tx.createdAt).toLocaleString('fr-FR')}
              </span>
            </div>
            <span
              className={`font-semibold ${
                tx.type === 'escrow_hold' || tx.type === 'transfer'
                  ? 'text-gray-300'
                  : 'text-milou-success'
              }`}
            >
              {sign}
              {tx.amount.toFixed(2)} M
            </span>
          </li>
        );
      })}
    </ul>
  );
}
