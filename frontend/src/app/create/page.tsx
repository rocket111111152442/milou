'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { listingsApi, premiumApi } from '@/lib/api';
import { SERVICE_CATEGORIES, PREMIUM_FEATURES } from '@/lib/premium/config';

export default function CreateListingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<{ used: number; max: number } | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'devoirs',
    price: 5,
    type: 'offer' as 'offer' | 'request',
    tags: '',
    estimatedDelay: '3 jours',
    missionType: 'standard',
  });

  useEffect(() => {
    if (!user) return;
    premiumApi
      .usage()
      .then((u) => {
        setUsage({
          used: u.usage.listingsThisMonth,
          max: u.limits.maxListingsPerMonth,
        });
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement...</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    try {
      await listingsApi.create({
        title: form.title,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        type: form.type,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        estimatedDelay: form.estimatedDelay,
        missionType: form.missionType,
      });
      router.push('/marketplace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  const previewCategory = SERVICE_CATEGORIES.find((c) => c.id === form.category);

  return (
    <>
      <Navbar />
      <AppShell
        title="Créer une annonce"
        subtitle="Publiez sur le marketplace — visible par toute la communauté"
        headerRight={
          <Link href="/marketplace" className="btn-secondary text-sm">
            ← Marketplace
          </Link>
        }
        sidebarExtra={
          <div className="space-y-4 text-sm">
            <p className="sidebar-section-title">Aperçu live</p>
            <div className="p-4 rounded-2xl border border-white/[0.06] bg-milou-surface/50">
              <p className="text-xs text-indigo-400 mb-1 font-medium">{previewCategory?.label}</p>
              <p className="font-bold text-white truncate">{form.title || 'Titre de votre annonce'}</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-2">{form.price} M</p>
              <p className="text-xs text-gray-500 mt-2 line-clamp-3">
                {form.description || 'Votre description apparaîtra ici…'}
              </p>
            </div>
            {!user.isPremium && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <p className="text-amber-300 text-xs font-semibold">Compte gratuit</p>
                <p className="text-gray-400 text-xs mt-1">
                  {usage ? `${usage.used}/${usage.max} annonces ce mois` : 'Limite mensuelle d\'annonces'}
                </p>
                <Link href="/premium" className="text-amber-400 text-xs underline mt-2 inline-block">
                  Passer Premium →
                </Link>
              </div>
            )}
            <p className="sidebar-section-title">Avantages Premium</p>
            <ul className="space-y-1 text-xs text-gray-500">
              {PREMIUM_FEATURES.slice(0, 5).map((f) => (
                <li key={f.id} className="flex gap-2">
                  <span className="text-amber-400">★</span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        }
      >
        <div className="grid lg:grid-cols-5 gap-8">
          <form onSubmit={handleSubmit} className="lg:col-span-3 card space-y-4">
            <div>
              <label className="label">Titre</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex : Aide maths terminale"
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[140px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Détaillez ce que vous proposez ou recherchez…"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Format</label>
                <select
                  className="input"
                  value={form.missionType}
                  onChange={(e) => setForm({ ...form, missionType: e.target.value })}
                >
                  <option value="standard">Mission classique</option>
                  <option value="micro-job">Micro-job rapide ⚡</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Prix (M)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="label">Délai estimé</label>
                <input
                  className="input"
                  value={form.estimatedDelay}
                  onChange={(e) => setForm({ ...form, estimatedDelay: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl border ${form.type === 'offer' ? 'chip-active' : 'chip'}`}
                  onClick={() => setForm({ ...form, type: 'offer' })}
                >
                  J&apos;offre un service
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl border ${form.type === 'request' ? 'chip-active' : 'chip'}`}
                  onClick={() => setForm({ ...form, type: 'request' })}
                >
                  Je cherche de l&apos;aide
                </button>
              </div>
            </div>
            <div>
              <label className="label">Tags (virgules)</label>
              <input
                className="input"
                placeholder="maths, logo, python"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            {error && <p className="alert-error py-2">{error}</p>}
            <button type="submit" className="btn-primary w-full py-3">
              Publier sur le marketplace
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <h3 className="font-semibold text-white mb-2">Conseils</h3>
              <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                <li>Titre clair et précis</li>
                <li>Prix réaliste en Milou</li>
                <li>Ajoutez des tags pour être trouvé</li>
                <li>Premium = mise en avant auto</li>
              </ul>
            </div>
            <div className="card">
              <p className="text-sm text-zinc-400">
                Vous pourrez <strong className="text-red-300">supprimer</strong> votre annonce depuis le dashboard ou le
                marketplace tant qu&apos;aucune mission n&apos;est en cours.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    </>
  );
}
