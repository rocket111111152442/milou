'use client';

import { useCallback, useEffect, useState } from 'react';
import TransactionList from '@/components/TransactionList';
import PremiumBadge from '@/components/PremiumBadge';
import { adminApi } from '@/lib/api';
import type { AdminUserDetailResponse, User, UserRole, UserStatus } from '@/lib/types';

type Props = {
  userId: string | null;
  onUserUpdated?: (u: User) => void;
  onMessage?: (msg: string) => void;
};

export default function AdminUserInspector({ userId, onUserUpdated, onMessage }: Props) {
  const [detail, setDetail] = useState<AdminUserDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState({
    firstname: '',
    lastname: '',
    reputation: 0,
    moderatorNotes: '',
    role: 'user' as UserRole,
    status: 'active' as UserStatus,
  });
  const [balanceAmount, setBalanceAmount] = useState('10');
  const [premiumMonths, setPremiumMonths] = useState('1');
  const [subTab, setSubTab] = useState<'overview' | 'tx' | 'listings' | 'missions'>('overview');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await adminApi.userDetail(userId);
      setDetail(data);
      setEdit({
        firstname: data.user.firstname,
        lastname: data.user.lastname,
        reputation: data.user.reputation,
        moderatorNotes: data.user.moderatorNotes ?? '',
        role: data.user.role,
        status: (data.user.status ?? 'active') as UserStatus,
      });
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Erreur chargement');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId, onMessage]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) {
    return (
      <div className="card text-center text-gray-500 py-12">
        Sélectionnez un utilisateur dans la liste ou la recherche pour l&apos;examiner en détail.
      </div>
    );
  }

  if (loading && !detail) {
    return <div className="card text-center py-12 text-cyan-400">Chargement du dossier…</div>;
  }

  if (!detail) {
    return <div className="card text-center py-12 text-milou-danger">Dossier introuvable</div>;
  }

  const u = detail.user;

  async function saveProfile() {
    try {
      const r = await adminApi.updateUser(userId!, {
        firstname: edit.firstname,
        lastname: edit.lastname,
        reputation: edit.reputation,
        moderatorNotes: edit.moderatorNotes,
        role: edit.role,
        status: edit.status,
      });
      onUserUpdated?.(r.user);
      onMessage?.('Profil mis à jour');
      await load();
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function adjustBalance(action: 'add' | 'remove') {
    try {
      const r = await adminApi.adjustBalance(userId!, parseFloat(balanceAmount), action);
      onUserUpdated?.(r.user);
      onMessage?.(`Solde ${action === 'add' ? 'crédité' : 'débité'}`);
      await load();
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function setPremium(action: 'grant' | 'revoke') {
    try {
      if (action === 'grant' && !confirm(`Offrir Premium gratuit (${premiumMonths} mois) à cet utilisateur ?`)) return;
      if (action === 'revoke' && !confirm('Retirer le Premium de cet utilisateur ?')) return;

      const r = await adminApi.setPremium(userId!, {
        action,
        months: action === 'grant' ? Number(premiumMonths) || 1 : undefined,
      });
      onUserUpdated?.(r.user);
      onMessage?.(r.message);
      await load();
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function resetPassword() {
    try {
      const r = await adminApi.resetPassword(userId!);
      await navigator.clipboard.writeText(r.resetLink);
      onMessage?.('Lien de réinitialisation copié dans le presse-papiers');
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <div className="space-y-4">
      <div className="card border-violet-500/30">
        <div className="flex flex-wrap justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex flex-wrap items-center gap-2">
              {u.firstname} {u.lastname}
              {u.isPremium && <PremiumBadge />}
            </h2>
            <p className="text-gray-400 text-sm">{u.email}</p>
            <p className="text-xs text-gray-500 mt-1 font-mono break-all">ID : {u.id}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-cyan-400">{u.balance.toFixed(2)} M</p>
            <p className="text-sm text-gray-400">Réputation {u.reputation} · {u.transactionCount} tx</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-4">
          <div className="bg-milou-bg rounded-lg p-3">
            <p className="text-gray-500">Statut compte</p>
            <p className="capitalize font-medium">{u.status ?? 'active'}</p>
          </div>
          <div className="bg-milou-bg rounded-lg p-3">
            <p className="text-gray-500">Rôle</p>
            <p className="capitalize font-medium">{u.role}</p>
          </div>
          <div className="bg-milou-bg rounded-lg p-3">
            <p className="text-gray-500">Total gagné / dépensé</p>
            <p className="font-medium">{u.totalEarned.toFixed(0)} / {u.totalSpent.toFixed(0)} M</p>
          </div>
          <div className="bg-milou-bg rounded-lg p-3">
            <p className="text-gray-500">Inscrit le</p>
            <p className="font-medium">{new Date(u.createdAt).toLocaleDateString('fr-FR')}</p>
          </div>
          <div className="bg-milou-bg rounded-lg p-3 sm:col-span-2 lg:col-span-4">
            <p className="text-gray-500">Premium MILOU</p>
            <p className="font-medium text-amber-300">
              {u.isPremium
                ? `Actif${u.premiumExpiresAt ? ` jusqu'au ${new Date(u.premiumExpiresAt).toLocaleDateString('fr-FR')}` : ''}`
                : 'Non actif'}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-400 border-t border-milou-border pt-4">
          <div>
            <p>Firebase Auth</p>
            <ul className="mt-1 space-y-0.5">
              <li>E-mail vérifié : {detail.auth.emailVerified ? 'oui' : 'non'}</li>
              <li>Compte désactivé : {detail.auth.disabled ? 'oui' : 'non'}</li>
              <li>Dernière connexion : {detail.auth.lastSignIn ? new Date(detail.auth.lastSignIn).toLocaleString('fr-FR') : '—'}</li>
            </ul>
          </div>
          <div>
            <p>Activité plateforme</p>
            <ul className="mt-1 space-y-0.5">
              <li>{detail.counts.listings} annonce(s)</li>
              <li>{detail.counts.missions} mission(s)</li>
              <li>{detail.counts.transactions} transaction(s) liées</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card space-y-3 border-amber-500/20">
        <h3 className="font-semibold text-amber-300">Premium gratuit (admin)</h3>
        <p className="text-xs text-gray-500">
          Offrir ou retirer Premium sans paiement Stripe. L&apos;utilisateur reçoit une notification.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="input w-20"
            type="number"
            min={1}
            max={120}
            value={premiumMonths}
            onChange={(e) => setPremiumMonths(e.target.value)}
            title="Durée en mois"
          />
          <span className="text-sm text-gray-400">mois</span>
          <button
            type="button"
            className="btn-primary text-sm bg-gradient-to-r from-amber-500 to-yellow-500"
            onClick={() => setPremium('grant')}
          >
            Offrir Premium
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setPremiumMonths('12');
              void setPremium('grant');
            }}
          >
            Offrir 12 mois
          </button>
          {u.isPremium && (
            <button type="button" className="btn-secondary text-sm text-amber-200" onClick={() => setPremium('revoke')}>
              Retirer Premium
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold text-violet-300">Modifier le profil</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="input" value={edit.firstname} onChange={(e) => setEdit({ ...edit, firstname: e.target.value })} placeholder="Prénom" />
            <input className="input" value={edit.lastname} onChange={(e) => setEdit({ ...edit, lastname: e.target.value })} placeholder="Nom" />
          </div>
          <input className="input" type="number" value={edit.reputation} onChange={(e) => setEdit({ ...edit, reputation: Number(e.target.value) })} placeholder="Réputation" />
          <select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as UserRole })}>
            <option value="user">Utilisateur</option>
            <option value="moderator">Modérateur</option>
            <option value="admin">Administrateur</option>
          </select>
          <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as UserStatus })}>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="banned">Banni</option>
          </select>
          <textarea
            className="input min-h-[80px]"
            value={edit.moderatorNotes}
            onChange={(e) => setEdit({ ...edit, moderatorNotes: e.target.value })}
            placeholder="Notes internes modérateur (invisible pour l'utilisateur)"
          />
          <button type="button" className="btn-primary w-full" onClick={saveProfile}>
            Enregistrer les modifications
          </button>
        </div>

        <div className="card space-y-3">
          <h3 className="font-semibold text-violet-300">Actions rapides</h3>
          <div className="flex gap-2">
            <input className="input flex-1" type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} />
            <button type="button" className="btn-primary text-sm" onClick={() => adjustBalance('add')}>+ M</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => adjustBalance('remove')}>- M</button>
          </div>
          <button type="button" className="btn-secondary w-full text-sm" onClick={resetPassword}>
            Générer lien réinitialisation mot de passe
          </button>
          <button
            type="button"
            className="w-full text-sm text-milou-danger border border-milou-danger/40 rounded-lg py-2 hover:bg-milou-danger/10"
            onClick={async () => {
              if (!confirm('Supprimer définitivement ce compte ?')) return;
              await adminApi.deleteUser(userId!);
              onMessage?.('Compte supprimé');
              setDetail(null);
            }}
          >
            Supprimer le compte
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['overview', 'tx', 'listings', 'missions'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${subTab === t ? 'bg-violet-500/20 text-violet-300' : 'bg-milou-card text-gray-400'}`}
          >
            {t === 'overview' ? 'Résumé' : t === 'tx' ? 'Transactions' : t === 'listings' ? 'Annonces' : 'Missions'}
          </button>
        ))}
      </div>

      {subTab === 'tx' && (
        <div className="card max-h-96 overflow-y-auto">
          <TransactionList transactions={detail.transactions as import('@/lib/types').Transaction[]} />
        </div>
      )}

      {subTab === 'listings' && (
        <div className="space-y-2">
          {detail.listings.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune annonce</p>
          ) : (
            detail.listings.map((l) => (
              <div key={l._id} className="card text-sm py-3">
                <p className="font-medium">{String((l as { title?: string }).title)}</p>
                <p className="text-gray-400">{(l as { status?: string }).status} · {(l as { price?: number }).price} M</p>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'missions' && (
        <div className="space-y-2">
          {[...detail.missionsAsClient, ...detail.missionsAsProvider].map((m) => (
            <div key={m._id} className="card text-sm py-3">
              <p className="font-medium">Mission {m._id.slice(0, 8)}…</p>
              <p className="text-gray-400">
                {m.status} · {m.amount} M — client: {m.clientId.email} / prestataire: {m.providerId.email}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
