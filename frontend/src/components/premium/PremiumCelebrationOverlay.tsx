'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconStar } from '@/components/ui/Icons';

interface Props {
  onClose: () => void;
  expiresAt?: string | null;
  subtitle?: string;
}

const PERKS = ['Badge exclusif', 'Annonces à la une', 'Limites étendues'];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function PremiumCelebrationOverlay({ onClose, expiresAt, subtitle }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: randomBetween(5, 95),
        delay: randomBetween(0, 0.8),
        duration: randomBetween(1.2, 2.4),
        size: randomBetween(4, 10),
        drift: randomBetween(-40, 40),
        hue: i % 3 === 0 ? 'amber' : i % 3 === 1 ? 'yellow' : 'orange',
      })),
    []
  );

  const rays = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const enterTimer = setTimeout(() => setPhase('hold'), 900);
    const exitTimer = setTimeout(() => setPhase('exit'), 4800);
    const closeTimer = setTimeout(onClose, 5600);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const expiryLabel =
    expiresAt &&
    new Date(expiresAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div
      className={`premium-celebration-root ${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label="Premium MILOU activé"
      onClick={onClose}
    >
      <div className="premium-celebration-vignette" aria-hidden />

      {/* Particules */}
      <div className="premium-celebration-particles" aria-hidden>
        {particles.map((p) => (
          <span
            key={p.id}
            className={`premium-particle premium-particle-${p.hue}`}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--drift' as string]: `${p.drift}px`,
            }}
          />
        ))}
      </div>

      {/* Contenu central */}
      <div
        className="premium-celebration-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="premium-celebration-burst" aria-hidden>
          {rays.map((i) => (
            <span
              key={i}
              className="premium-ray"
              style={{ transform: `rotate(${i * 30}deg)` }}
            />
          ))}
        </div>

        <div className="premium-celebration-icon-wrap">
          <div className="premium-celebration-ring premium-celebration-ring-1" />
          <div className="premium-celebration-ring premium-celebration-ring-2" />
          <div className="premium-celebration-icon">
            <IconStar className="w-14 h-14 sm:w-16 sm:h-16 text-amber-100 drop-shadow-lg" />
          </div>
        </div>

        <p className="premium-celebration-eyebrow">MILOU PREMIUM</p>
        <h2 className="premium-celebration-title">STATUT ÉLITE</h2>
        <p className="premium-celebration-tagline">Nouveau palier débloqué</p>

        {subtitle && <p className="premium-celebration-subtitle">{subtitle}</p>}

        <ul className="premium-celebration-perks">
          {PERKS.map((perk, i) => (
            <li
              key={perk}
              className="premium-celebration-perk"
              style={{ animationDelay: `${0.55 + i * 0.12}s` }}
            >
              <span className="premium-perk-dot" />
              {perk}
            </li>
          ))}
        </ul>

        {expiryLabel && (
          <p className="premium-celebration-expiry">Actif jusqu&apos;au {expiryLabel}</p>
        )}

        <button type="button" className="premium-celebration-cta" onClick={onClose}>
          Continuer
        </button>
      </div>
    </div>
  );
}
