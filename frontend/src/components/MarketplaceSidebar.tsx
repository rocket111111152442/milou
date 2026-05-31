'use client';

import Link from 'next/link';
import { SERVICE_CATEGORIES } from '@/lib/premium/config';

interface Props {
  category: string;
  onCategory: (c: string) => void;
  typeFilter: string;
  onTypeFilter: (t: string) => void;
  sort: string;
  onSort: (s: string) => void;
  maxPrice: string;
  onMaxPrice: (p: string) => void;
  mineOnly: boolean;
  onMineOnly: (v: boolean) => void;
  nearMe?: boolean;
  onNearMe?: (v: boolean) => void;
  postalFilter?: string;
  onPostalFilter?: (v: string) => void;
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
  stats: { total: number; offers: number; requests: number; featured: number };
  loggedIn: boolean;
  hasPostal?: boolean;
}

export default function MarketplaceSidebar({
  category,
  onCategory,
  typeFilter,
  onTypeFilter,
  sort,
  onSort,
  maxPrice,
  onMaxPrice,
  mineOnly,
  onMineOnly,
  nearMe,
  onNearMe,
  postalFilter,
  onPostalFilter,
  view,
  onView,
  stats,
  loggedIn,
  hasPostal,
}: Props) {
  return (
    <div className="space-y-4 text-sm">
      <div className="p-3 rounded-2xl bg-milou-surface/60 border border-white/[0.06]">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">En direct</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: stats.total, label: 'Annonces' },
            { val: stats.featured, label: 'À la une' },
            { val: stats.offers, label: 'Offres' },
            { val: stats.requests, label: 'Demandes' },
          ].map((s) => (
            <div key={s.label} className="stat-pill">
              <span className="stat-value">{s.val}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="sidebar-section-title">Affichage</p>
        <div className="flex gap-1">
          <button
            type="button"
            className={`flex-1 py-2 rounded-xl text-xs ${view === 'grid' ? 'chip-active' : 'chip'}`}
            onClick={() => onView('grid')}
          >
            Grille
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-xl text-xs ${view === 'list' ? 'chip-active' : 'chip'}`}
            onClick={() => onView('list')}
          >
            Liste
          </button>
        </div>
      </div>

      <div>
        <p className="sidebar-section-title">Trier par</p>
        <select className="input text-sm" value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="featured">Mises en avant</option>
          <option value="recent">Plus récentes</option>
          <option value="price-asc">Prix croissant</option>
          <option value="price-desc">Prix décroissant</option>
        </select>
      </div>

      <div>
        <p className="sidebar-section-title">Prix max (M)</p>
        <input
          className="input text-sm"
          type="number"
          min={0}
          placeholder="Illimité"
          value={maxPrice}
          onChange={(e) => onMaxPrice(e.target.value)}
        />
      </div>

      <div>
        <p className="sidebar-section-title">Type</p>
        <div className="flex flex-col gap-1">
          {[
            { v: '', label: 'Tous' },
            { v: 'offer', label: 'Offres' },
            { v: 'request', label: 'Demandes' },
          ].map((t) => (
            <button
              key={t.v || 'all'}
              type="button"
              className={`text-left px-3 py-2 rounded-xl ${typeFilter === t.v ? 'chip-active' : 'chip'}`}
              onClick={() => onTypeFilter(t.v)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loggedIn && (
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl chip cursor-pointer">
          <input type="checkbox" checked={mineOnly} onChange={(e) => onMineOnly(e.target.checked)} className="accent-indigo-500" />
          <span>Mes annonces seulement</span>
        </label>
      )}

      {loggedIn && onNearMe && (
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl chip cursor-pointer">
          <input
            type="checkbox"
            checked={!!nearMe}
            onChange={(e) => onNearMe(e.target.checked)}
            disabled={!hasPostal}
            className="accent-indigo-500"
          />
          <span>Près de chez moi{!hasPostal ? ' (code postal requis)' : ''}</span>
        </label>
      )}

      {onPostalFilter && (
        <div>
          <p className="sidebar-section-title">Code postal</p>
          <input
            className="input text-sm"
            placeholder="Ex : 75001"
            value={postalFilter || ''}
            onChange={(e) => onPostalFilter(e.target.value)}
            inputMode="numeric"
          />
        </div>
      )}

      <div>
        <p className="sidebar-section-title">Catégories</p>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
          <button
            type="button"
            className={`text-left px-3 py-1.5 rounded-xl text-xs ${category === 'Tous' ? 'chip-active' : 'chip'}`}
            onClick={() => onCategory('Tous')}
          >
            Toutes
          </button>
          {SERVICE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`text-left px-3 py-1.5 rounded-xl text-xs ${category === c.id ? 'chip-active' : 'chip'}`}
              onClick={() => onCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Link href="/create" className="btn-primary w-full text-center text-sm block">
        Publier une annonce
      </Link>
    </div>
  );
}
