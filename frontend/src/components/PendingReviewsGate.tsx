'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { reviewsApi } from '@/lib/api';
import { PendingReviewMission } from '@/lib/types';
import MissionReviewForm from '@/components/MissionReviewForm';
import { IconStar } from '@/components/ui/Icons';

const ALLOWED = ['/dashboard', '/profile', '/rules', '/how-it-works', '/faq', '/login'];
/** Vérification au changement de page, au plus une fois par minute (quota Firestore). */
const MIN_INTERVAL_MS = 60_000;

export default function PendingReviewsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingReviewMission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const lastFetch = useRef(0);

  const load = useCallback(
    (force = false) => {
      if (!user) {
        setPending([]);
        setLoaded(true);
        return;
      }
      if (!force && Date.now() - lastFetch.current < MIN_INTERVAL_MS) return;
      lastFetch.current = Date.now();
      reviewsApi
        .pending()
        .then((r) => setPending(r.pending))
        .catch(() => setPending([]))
        .finally(() => setLoaded(true));
    },
    [user?.id]
  );

  useEffect(() => {
    setLoaded(false);
    load(true);
  }, [load]);

  useEffect(() => {
    load();
  }, [pathname, load]);

  const blocked =
    loaded &&
    pending.length > 0 &&
    !ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!blocked) return <>{children}</>;

  const first = pending[0];

  return (
    <>
      {children}
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-review-title"
      >
        <div className="card max-w-md w-full border-amber-500/20 shadow-glow animate-fade-up my-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <IconStar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="section-label text-amber-400">Avis requis</p>
              <h2 id="pending-review-title" className="text-lg font-semibold text-white leading-tight">
                Notez votre dernière mission
              </h2>
            </div>
          </div>
          <p className="text-sm text-zinc-400">
            Mission terminée : <strong className="text-zinc-200 font-medium">{first.listingTitle}</strong>
            {pending.length > 1 && (
              <span className="badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 ml-2">
                {pending.length} en attente
              </span>
            )}
          </p>
          <MissionReviewForm
            key={first.missionId}
            missionId={first.missionId}
            partnerName={first.toUserName}
            onDone={() => setTimeout(() => load(true), 900)}
          />
        </div>
      </div>
    </>
  );
}
