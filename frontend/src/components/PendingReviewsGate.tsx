'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { reviewsApi } from '@/lib/api';
import { PendingReviewMission } from '@/lib/types';
import MissionReviewForm from '@/components/MissionReviewForm';

const ALLOWED = ['/dashboard', '/profile', '/rules', '/how-it-works', '/faq', '/login'];

export default function PendingReviewsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingReviewMission[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    if (!user) {
      setPending([]);
      setLoaded(true);
      return;
    }
    reviewsApi
      .pending()
      .then((r) => setPending(r.pending))
      .catch(() => setPending([]))
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    setLoaded(false);
    load();
    if (!user) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  const blocked =
    loaded &&
    pending.length > 0 &&
    !ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!blocked) return <>{children}</>;

  const first = pending[0];

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
        <div className="card max-w-md w-full border-amber-500/30">
          <h2 className="text-lg font-semibold text-white mb-2">Avis obligatoire</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Avant de continuer sur MILOU, laissez un avis sur votre mission terminée :{' '}
            <strong className="text-zinc-200">{first.listingTitle}</strong> avec{' '}
            {first.toUserName}.
            {pending.length > 1 && ` (${pending.length} en attente)`}
          </p>
          <MissionReviewForm
            missionId={first.missionId}
            onDone={() => {
              load();
            }}
          />
          <p className="text-xs text-zinc-600 mt-4">
            Les avis renforcent la confiance sur la plateforme. Merci de rester factuel et respectueux.
          </p>
        </div>
      </div>
    </>
  );
}
