export type MissionStep = {
  id: string;
  label: string;
  done: boolean;
  doneAt?: string | null;
};

export const DEFAULT_MISSION_STEPS: Omit<MissionStep, 'done' | 'doneAt'>[] = [
  { id: 'start', label: 'Mission acceptée' },
  { id: 'work', label: 'Travail en cours' },
  { id: 'deliver', label: 'Livraison au client' },
  { id: 'validate', label: 'Validation client' },
];

export function buildDefaultMissionSteps(): MissionStep[] {
  return DEFAULT_MISSION_STEPS.map((s, i) => ({
    ...s,
    done: i === 0,
    doneAt: i === 0 ? new Date().toISOString() : null,
  }));
}

export function missionProgressPercent(steps: MissionStep[]): number {
  if (!steps.length) return 0;
  const done = steps.filter((s) => s.done).length;
  return Math.round((done / steps.length) * 100);
}
