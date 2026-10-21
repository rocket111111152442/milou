import timeline from '../timeline.json' with { type: 'json' };

export const T = timeline;
export const BEAT = timeline.beatFrames / timeline.fps; // secondes par temps
/** Convertit un nombre de temps en secondes. */
export const b = (beats) => beats * BEAT;
export const DURATION = (timeline.totalBeats * timeline.beatFrames + timeline.tailFrames) / timeline.fps;
export const W = timeline.width;
export const H = timeline.height;
export const scene = (id) => {
  const s = timeline.scenes.find((x) => x.id === id);
  return { start: b(s.start), end: b(s.end), beats: s };
};
