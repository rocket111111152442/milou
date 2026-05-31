'use client';

import { useState } from 'react';
import { listingsApi } from '@/lib/api';
import { MissionStep, missionProgressPercent } from '@/lib/mission-steps';

export default function MissionStepsBar({
  missionId,
  steps: initialSteps,
  isClient,
  isProvider,
  onUpdate,
}: {
  missionId: string;
  steps?: MissionStep[];
  isClient: boolean;
  isProvider: boolean;
  onUpdate?: () => void;
}) {
  const [steps, setSteps] = useState<MissionStep[]>(initialSteps || []);
  const [loading, setLoading] = useState<string | null>(null);

  if (!steps.length) return null;

  const pct = missionProgressPercent(steps);

  async function toggle(stepId: string, done: boolean) {
    setLoading(stepId);
    try {
      const res = await listingsApi.updateMissionStep(missionId, stepId, done);
      setSteps(res.steps || []);
      onUpdate?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Progression mission</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1">
        {steps.map((s) => {
          const canToggle =
            (s.id === 'validate' && isClient) ||
            (s.id !== 'validate' && isProvider);
          return (
            <li key={s.id} className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={!canToggle || loading === s.id}
                onClick={() => canToggle && toggle(s.id, !s.done)}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  s.done
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'border-zinc-600 text-transparent'
                } ${canToggle ? 'cursor-pointer hover:border-indigo-400' : 'opacity-50 cursor-default'}`}
              >
                {s.done ? '✓' : ''}
              </button>
              <span className={s.done ? 'text-zinc-300' : 'text-zinc-500'}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
