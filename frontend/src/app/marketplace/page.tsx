'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ListingCard from '@/components/ListingCard';
import { useAuth } from '@/context/AuthContext';
import { listingsApi } from '@/lib/api';
import { fetchListings } from '@/lib/firestore-client';
import { Listing } from '@/lib/types';

const CATEGORIES = ['Tous', 'Design', 'Dev', 'Rédaction', 'Coaching', 'Autre'];

export default function MarketplacePage() {
  const { user, loading, refreshUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('Tous');
  const [typeFilter, setTypeFilter] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    fetchListings(category, typeFilter).then(setListings).catch(console.error);
  };

  useEffect(() => {
    load();
  }, [category, typeFilter]);

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

        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                category === c ? 'bg-cyan-500/20 text-cyan-400' : 'bg-milou-card text-gray-400'
              }`}
            >
              {c}
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
        {listings.length === 0 && (
          <p className="text-center text-gray-500 py-12">Aucune annonce disponible.</p>
        )}
      </main>
    </>
  );
}
