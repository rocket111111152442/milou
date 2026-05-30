'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ListingCard from '@/components/ListingCard';
import { useAuth } from '@/context/AuthContext';
import { listingsApi } from '@/lib/api';
import { Listing } from '@/lib/types';

import { SERVICE_CATEGORIES } from '@/lib/premium/config';

const CATEGORIES = ['Tous', ...SERVICE_CATEGORIES.map((c) => c.id)];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, `${c.icon} ${c.label}`])
);

export default function MarketplacePage() {
  const { user, loading, refreshUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('Tous');
  const [typeFilter, setTypeFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (category && category !== 'Tous') params.set('category', category);
    if (typeFilter) params.set('type', typeFilter);
    if (search.trim()) params.set('q', search.trim());
    listingsApi
      .list(params.toString())
      .then((r) => setListings(r.listings))
      .catch((err) => {
        console.error(err);
        setMsg(err instanceof Error ? err.message : 'Impossible de charger les annonces.');
      });
  };

  useEffect(() => {
    load();
  }, [category, typeFilter, search]);

  async function handleAccept(id: string) {
    if (!user) return;
    setMsg('');
    try {
      await listingsApi.accept(id);
      setMsg('Mission démarrée ! Les Milou sont en escrow.');
      await refreshUser();
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <>
      {user && <Navbar />}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Marketplace</h1>
        <p className="text-gray-400 mb-6">Découvrez et acceptez des services</p>

        {!user && !loading && (
          <div className="card mb-6 text-center">
            <p className="text-gray-400 mb-3">Connectez-vous pour accepter une annonce</p>
            <a href="/login" className="btn-primary inline-block">Connexion</a>
          </div>
        )}

        <input
          className="input mb-4 max-w-md"
          placeholder="Rechercher un service…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                category === c ? 'bg-cyan-500/20 text-cyan-400' : 'bg-milou-card text-gray-400'
              }`}
            >
              {c === 'Tous' ? 'Tous' : CATEGORY_LABELS[c] || c}
            </button>
          ))}
          <select
            className="input w-auto ml-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tous types</option>
            <option value="offer">Offres</option>
            <option value="request">Demandes</option>
          </select>
        </div>

        {msg && <p className="mb-4 text-cyan-400 text-sm">{msg}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          {listings.map((l) => (
            <ListingCard
              key={l._id}
              listing={l}
              showActions={!!user}
              onAccept={user ? handleAccept : undefined}
              currentUserId={user?.id}
            />
          ))}
        </div>
        {listings.length === 0 && !msg && (
          <div className="text-center py-12 card max-w-lg mx-auto">
            <p className="text-gray-300 mb-2">Aucune annonce pour le moment</p>
            <p className="text-gray-500 text-sm mb-4">
              Le marketplace est vide tant que personne n&apos;a publié de service.
            </p>
            {user ? (
              <Link href="/create" className="btn-primary inline-block text-sm">
                Créer la première annonce
              </Link>
            ) : (
              <Link href="/register" className="btn-primary inline-block text-sm">
                S&apos;inscrire et publier
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
