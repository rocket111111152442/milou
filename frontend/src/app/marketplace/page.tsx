'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import MarketplaceSidebar from '@/components/MarketplaceSidebar';
import ListingCard from '@/components/ListingCard';
import { useAuth } from '@/context/AuthContext';
import { listingsApi } from '@/lib/api';
import { Listing } from '@/lib/types';
import { getListingOwnerId } from '@/lib/listing-utils';

export default function MarketplacePage() {
  const { user, loading, refreshUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('Tous');
  const [typeFilter, setTypeFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [maxPrice, setMaxPrice] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        setMsgType('error');
        setMsg(err instanceof Error ? err.message : 'Impossible de charger les annonces.');
      });
  };

  useEffect(() => {
    load();
  }, [category, typeFilter, search]);

  const filtered = useMemo(() => {
    let list = [...listings];
    const max = maxPrice ? Number(maxPrice) : 0;
    if (max > 0) list = list.filter((l) => l.price <= max);
    if (mineOnly && user) list = list.filter((l) => getListingOwnerId(l) === user.id);

    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'recent':
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        break;
      default:
        list.sort((a, b) => {
          const fa = a.featured ? 1 : 0;
          const fb = b.featured ? 1 : 0;
          if (fb !== fa) return fb - fa;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }
    return list;
  }, [listings, maxPrice, mineOnly, user, sort]);

  const stats = useMemo(
    () => ({
      total: listings.length,
      offers: listings.filter((l) => l.type === 'offer').length,
      requests: listings.filter((l) => l.type === 'request').length,
      featured: listings.filter((l) => l.featured).length,
    }),
    [listings]
  );

  async function handleAccept(id: string) {
    if (!user) return;
    setMsg('');
    try {
      await listingsApi.accept(id);
      setMsgType('success');
      setMsg('Mission démarrée ! Les Milou sont en escrow.');
      await refreshUser();
      load();
    } catch (err) {
      setMsgType('error');
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function handleDelete(id: string) {
    setMsg('');
    setDeletingId(id);
    try {
      await listingsApi.delete(id);
      setListings((prev) => prev.filter((l) => l._id !== id));
      setMsgType('success');
      setMsg('Annonce supprimée du site.');
    } catch (err) {
      setMsgType('error');
      setMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

  const sidebar = (
    <MarketplaceSidebar
      category={category}
      onCategory={setCategory}
      typeFilter={typeFilter}
      onTypeFilter={setTypeFilter}
      sort={sort}
      onSort={setSort}
      maxPrice={maxPrice}
      onMaxPrice={setMaxPrice}
      mineOnly={mineOnly}
      onMineOnly={setMineOnly}
      view={view}
      onView={setView}
      stats={stats}
      loggedIn={!!user}
    />
  );

  return (
    <>
      {user && <Navbar />}
      {!user && !loading && (
        <div className="border-b border-milou-border bg-gradient-to-r from-violet-900/30 to-cyan-900/20 px-4 py-3 text-center text-sm">
          <Link href="/login" className="text-cyan-400 hover:underline">
            Connectez-vous
          </Link>{' '}
          pour publier, supprimer vos annonces et accepter des missions.
        </div>
      )}

      <AppShell
        sidebarExtra={sidebar}
        title="Marketplace"
        subtitle="Services, micro-jobs et échanges en Milou — filtrez, triez, agissez"
        headerRight={
          <div className="flex flex-wrap gap-2">
            <Link href="/create" className="btn-primary text-sm">
              + Publier
            </Link>
            {user && (
              <Link href="/dashboard" className="btn-secondary text-sm">
                Dashboard
              </Link>
            )}
          </div>
        }
      >
        <div className="hero-glow mb-6" />

        <div className="lg:hidden mb-6 p-4 rounded-xl border border-milou-border bg-milou-card/50">
          {sidebar}
        </div>

        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                className="input flex-1"
                placeholder="🔍 Rechercher un service, un mot-clé…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex gap-2 lg:hidden">
                <button
                  type="button"
                  className={view === 'grid' ? 'chip-active px-3 py-2 rounded-lg' : 'chip px-3 py-2 rounded-lg'}
                  onClick={() => setView('grid')}
                >
                  Grille
                </button>
                <button
                  type="button"
                  className={view === 'list' ? 'chip-active px-3 py-2 rounded-lg' : 'chip px-3 py-2 rounded-lg'}
                  onClick={() => setView('list')}
                >
                  Liste
                </button>
              </div>
            </div>

            {msg && (
              <p
                className={
                  msgType === 'success' ? 'alert-success' : msgType === 'error' ? 'alert-error' : 'alert-info'
                }
              >
                {msgType === 'success' ? '✓' : msgType === 'error' ? '✕' : 'ℹ'} {msg}
              </p>
            )}

            <p className="text-sm text-gray-500">
              {filtered.length} annonce{filtered.length !== 1 ? 's' : ''} affichée{filtered.length !== 1 ? 's' : ''}
              {mineOnly && ' (les vôtres)'}
            </p>

            <div className={view === 'grid' ? 'grid md:grid-cols-2 gap-4' : 'flex flex-col gap-3'}>
              {filtered.map((l) => (
                <ListingCard
                  key={l._id}
                  listing={l}
                  showActions={!!user}
                  onAccept={user ? handleAccept : undefined}
                  onDelete={user ? handleDelete : undefined}
                  currentUserId={user?.id}
                  compact={view === 'list'}
                  deleting={deletingId === l._id}
                />
              ))}
            </div>

            {filtered.length === 0 && !msg && (
              <div className="text-center py-16 card border-dashed border-violet-500/30">
                <p className="text-4xl mb-3">🌌</p>
                <p className="text-gray-300 mb-2 font-medium">Aucune annonce ici</p>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                  Changez les filtres ou soyez le premier à proposer un service sur MILOU.
                </p>
                {user ? (
                  <Link href="/create" className="btn-primary inline-block text-sm">
                    Créer une annonce
                  </Link>
                ) : (
                  <Link href="/register" className="btn-primary inline-block text-sm">
                    S&apos;inscrire gratuitement
                  </Link>
                )}
              </div>
            )}
        </div>
      </AppShell>
    </>
  );
}
