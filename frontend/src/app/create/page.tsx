'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import ListingImageUpload from '@/components/ListingImageUpload';
import { listingsApi, premiumApi } from '@/lib/api';
import { SERVICE_CATEGORIES, PREMIUM_FEATURES } from '@/lib/premium/config';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function pluralizeDelay(value: number, singular: string, plural: string) {
  return `${value} ${value > 1 ? plural : singular}`;
}

function formatEstimatedDelay(delay: { days: number; hours: number; minutes: number }) {
  const parts = [];
  if (delay.days > 0) parts.push(pluralizeDelay(delay.days, 'jour', 'jours'));
  if (delay.hours > 0) parts.push(pluralizeDelay(delay.hours, 'heure', 'heures'));
  if (delay.minutes > 0) parts.push(pluralizeDelay(delay.minutes, 'minute', 'minutes'));
  return parts.join(' ') || '5 minutes';
}

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
    missionType: 'standard',
    isInPerson: false,
    postalCode: '',
  });
  const [delay, setDelay] = useState({ days: 3, hours: 0, minutes: 0 });
  const [images, setImages] = useState<string[]>([]);

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

  async function submitListing(publish: boolean) {
    if (!user) return;
    setError('');
    try {
      const res = await listingsApi.create({
        title: form.title,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        type: form.type,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        estimatedDelay: formatEstimatedDelay(delay),
        missionType: form.missionType,
        isInPerson: form.isInPerson,
        postalCode: form.isInPerson ? form.postalCode.trim() : undefined,
        images,
        publish,
      });
      router.push(res.draft ? '/dashboard' : '/marketplace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitListing(true);
  }

  const previewCategory = SERVICE_CATEGORIES.find((c) => c.id === form.category);
  const estimatedDelay = formatEstimatedDelay(delay);
  const needsBalance = form.type === 'request';
  const hasEnoughBalance = !needsBalance || Number(form.price) <= user.balance;

  function setDelayPart(part: 'days' | 'hours' | 'minutes', value: number) {
    setDelay((current) => {
      const next = { ...current, [part]: value };
      if (next.days === 0 && next.hours === 0 && next.minutes === 0) {
        next.minutes = 5;
      }
      return next;
    });
  }

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
              <p className="text-xs text-zinc-500 mt-1">{estimatedDelay}</p>
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
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="input"
                    value={delay.days}
                    onChange={(e) => setDelayPart('days', Number(e.target.value))}
                    aria-label="Jours"
                  >
                    {DAY_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value} j
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={delay.hours}
                    onChange={(e) => setDelayPart('hours', Number(e.target.value))}
                    aria-label="Heures"
                  >
                    {HOUR_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value} h
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={delay.minutes}
                    onChange={(e) => setDelayPart('minutes', Number(e.target.value))}
                    aria-label="Minutes"
                  >
                    {MINUTE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value} min
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Délai retenu : {estimatedDelay}</p>
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
            <div className="p-4 rounded-xl border border-white/[0.06] bg-milou-surface/40 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isInPerson}
                  onChange={(e) => setForm({ ...form, isInPerson: e.target.checked })}
                  className="rounded border-white/20"
                />
                <span className="text-sm text-white">Mission en vrai (présentiel)</span>
              </label>
              {form.isInPerson && (
                <div>
                  <label className="label">Code postal du lieu</label>
                  <input
                    className="input"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    required={form.isInPerson}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="Ex : 75001"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Les utilisateurs inscrits avec le même code postal recevront un e-mail dédié.
                  </p>
                </div>
              )}
            </div>
            <ListingImageUpload images={images} onChange={setImages} />
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
            {needsBalance && !hasEnoughBalance && (
              <p className="alert-error py-2 text-sm">
                Solde insuffisant pour cette demande : votre solde est de {user.balance.toFixed(2)} M (prix :{' '}
                {form.price} M).
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn-secondary flex-1 py-3"
                onClick={() => submitListing(false)}
              >
                Enregistrer en brouillon
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 py-3"
                disabled={!hasEnoughBalance || (form.isInPerson && !form.postalCode.trim())}
              >
                {!hasEnoughBalance && needsBalance
                  ? 'Solde insuffisant'
                  : form.isInPerson && !form.postalCode.trim()
                    ? 'Code postal requis'
                    : 'Publier'}
              </button>
            </div>
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
