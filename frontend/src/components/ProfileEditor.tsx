'use client';

import { useState } from 'react';
import Link from 'next/link';
import { profileApi } from '@/lib/api';
import { User } from '@/lib/types';

export default function ProfileEditor({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (u: User) => void;
}) {
  const [bio, setBio] = useState(user.bio || '');
  const [skillsText, setSkillsText] = useState((user.skills || []).join(', '));
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12);
      const { user: updated } = await profileApi.update({
        bio: bio.slice(0, 500),
        skills,
        avatarUrl: avatarUrl.slice(0, 500),
      });
      onSaved(updated);
      setMsg('Profil mis à jour');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3">
      <h2 className="font-semibold text-white">Profil public</h2>
      <div>
        <label className="label">Bio</label>
        <textarea className="input min-h-[80px]" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
      </div>
      <div>
        <label className="label">Compétences (virgules)</label>
        <input className="input" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="design, maths, python" />
      </div>
      <div>
        <label className="label">URL avatar (optionnel)</label>
        <input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
      </div>
      <button type="submit" className="btn-primary text-sm" disabled={loading}>
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      {msg && <p className="text-xs text-cyan-400">{msg}</p>}
      <Link href={`/profile/${user.id}`} className="text-sm text-indigo-400 hover:text-indigo-300 inline-block">
        Voir mon profil public →
      </Link>
    </form>
  );
}
