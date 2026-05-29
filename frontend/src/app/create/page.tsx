'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { createListing } from '@/lib/firestore-client';

export default function CreateListingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Dev',
    price: 5,
    type: 'offer' as 'offer' | 'request',
    tags: '',
    estimatedDelay: '3 jours',
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement...</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    try {
      await createListing(user.id, {
        title: form.title,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        type: form.type,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        estimatedDelay: form.estimatedDelay,
      });
      router.push('/marketplace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Créer une annonce</h1>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Titre</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[120px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Design', 'Dev', 'Rédaction', 'Coaching', 'Autre'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prix (Milou)</label>
              <input className="input" type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'offer' | 'request' })}>
                <option value="offer">Offre (je propose)</option>
                <option value="request">Demande (je cherche)</option>
              </select>
            </div>
            <div>
              <label className="label">Délai estimé</label>
              <input className="input" value={form.estimatedDelay} onChange={(e) => setForm({ ...form, estimatedDelay: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Tags (séparés par virgule)</label>
            <input className="input" placeholder="react, logo, seo" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          {error && <p className="text-milou-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full">Publier l&apos;annonce</button>
        </form>
      </main>
    </>
  );
}
