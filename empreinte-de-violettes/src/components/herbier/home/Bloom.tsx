"use client";

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect } from "react";
import type { PlateName } from "@/lib/plates";
import { Doily } from "../Lace";
import { Plate } from "../Plate";

// [planche, x (vw, centre), y (vh, centre), largeur (vw), rotation, profondeur 0–1, retournée]
type Flower = [PlateName, number, number, number, number, number, boolean?];

// une couronne de grosses fleurs qui déborde de tous les bords de l'écran
const FLOWERS: Flower[] = [
  ["pivoine", 6, 16, 30, -18, 1],
  ["rose", 24, 4, 20, 12, 0.6],
  ["anemone", 50, 2, 18, -4, 0.45, true],
  ["dahlia", 76, 6, 22, 20, 0.7],
  ["magnolia", 95, 22, 28, -10, 1, true],
  ["iris", 97, 56, 20, 14, 0.75],
  ["lys", 90, 92, 28, -16, 1, true],
  ["renoncule", 66, 98, 20, 8, 0.6],
  ["tulipe", 38, 99, 18, -12, 0.5, true],
  ["eglantier", 12, 92, 24, 18, 0.85],
  ["martagon", 2, 62, 22, -8, 0.9, true],
  ["fougere", 0, 38, 20, 24, 0.55],
  ["pensee", 34, 14, 11, -22, 0.25],
  ["violette", 70, 84, 12, 16, 0.3, true],
  ["julienne", 84, 36, 11, -14, 0.3],
  ["bouquet-ancien", 18, 72, 13, 10, 0.35],
];

/**
 * Couronne de fleurs gravées qui « sortent de l'écran » : elles arrivent de loin (petites, floues)
 * et grossissent vers nous, respirent, suivent la souris selon leur profondeur
 * et, au défilement, s'écartent en grossissant comme si on passait à travers.
 */
export function Bloom({ progress, start }: { progress: MotionValue<number>; start: number }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 18 });
  const sy = useSpring(my, { stiffness: 40, damping: 18 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [mx, my]);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* napperons de dentelle, derrière les fleurs */}
      <Lace progress={progress} start={start} />
      {FLOWERS.map((f, i) => (
        <Flower key={f[0]} f={f} i={i} sx={sx} sy={sy} progress={progress} start={start} />
      ))}
    </div>
  );
}

function Flower({ f, i, sx, sy, progress, start }: { f: Flower; i: number; sx: MotionValue<number>; sy: MotionValue<number>; progress: MotionValue<number>; start: number }) {
  const [name, x, y, w, rot, depth, flip] = f;
  // direction vers l'extérieur (depuis le centre de l'écran)
  const dx = x - 50;
  const dy = y - 50;
  const px = useTransform(sx, (v) => v * -60 * depth);
  const py = useTransform(sy, (v) => v * -40 * depth);
  const scrollScale = useTransform(progress, [0, 1], [1, 1 + 0.9 * depth]);
  const sxOut = useTransform(progress, [0, 1], [0, dx * 0.9 * depth]);
  const syOut = useTransform(progress, [0, 1], [0, dy * 0.9 * depth]);
  const toVw = useTransform(sxOut, (v) => `${v}vw`);
  const toVh = useTransform(syOut, (v) => `${v}vh`);
  const small = depth < 0.4;
  return (
    <motion.div
      className={small ? "absolute hidden will-change-transform md:block" : "absolute will-change-transform"}
      style={{ left: `${x}vw`, top: `${y}vh`, width: `clamp(${small ? 90 : 150}px, ${w}vw, ${w * 13}px)`, x: toVw, y: toVh, scale: scrollScale, zIndex: Math.round(depth * 10) }}
    >
      <motion.div style={{ x: px, y: py }}>
        <motion.div
          className="text-plum"
          style={{ translateX: "-50%", translateY: "-50%", rotate: rot }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.1, 1], opacity: 1 }}
          transition={{ duration: 2.2, delay: start + 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* respiration : la fleur avance et recule doucement vers nous */}
          <motion.div
            animate={{ scale: [1, 1.05 + depth * 0.05, 1], rotate: [0, (i % 2 ? 1 : -1) * 3, 0] }}
            transition={{ duration: 7 + (i % 5), delay: start + 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Plate name={name} flip={flip} reveal="none" opacity={0.6 + depth * 0.35} />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Lace({ progress, start }: { progress: MotionValue<number>; start: number }) {
  const s = useTransform(progress, [0, 1], [1, 1.35]);
  const DOILIES: [string, string, number, number][] = [
    // [position, taille, vitesse de rotation (s/tour), délai]
    ["inset-0 flex items-center justify-center", "", 160, 0.2],
    ["-left-[12vw] -top-[14vh]", "w-[46vw] min-w-[260px]", 120, 0.5],
    ["-right-[14vw] -bottom-[18vh]", "w-[50vw] min-w-[280px]", 140, 0.7],
  ];
  return (
    <>
      {DOILIES.map(([pos, size, speed, d], i) => (
        <motion.div key={i} className={`absolute ${pos} ${size}`} style={{ scale: s }}>
          {i === 0 ? (
            <motion.div className="w-[min(112vw,1050px)] -translate-y-[3vh]" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.85, scale: 1 }} transition={{ duration: 2, delay: start + d, ease: [0.16, 1, 0.3, 1] }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: speed, repeat: Infinity, ease: "linear" }}>
                <Doily className="w-full drop-shadow-[0_6px_14px_rgba(60,40,20,0.18)]" scallops={48} />
              </motion.div>
            </motion.div>
          ) : (
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: i === 0 ? 0.9 : 0.75, scale: 1 }} transition={{ duration: 2, delay: start + d, ease: [0.16, 1, 0.3, 1] }}>
            <motion.div animate={{ rotate: i % 2 ? -360 : 360 }} transition={{ duration: speed, repeat: Infinity, ease: "linear" }}>
              <Doily className="w-full drop-shadow-[0_6px_14px_rgba(60,40,20,0.18)]" scallops={30} />
            </motion.div>
          </motion.div>
          )}
        </motion.div>
      ))}
    </>
  );
}

