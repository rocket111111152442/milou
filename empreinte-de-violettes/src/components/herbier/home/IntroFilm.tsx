"use client";

import { motion } from "framer-motion";
import { EASE } from "../Elements";
import { Label } from "../Label";
import { Plate } from "../Plate";
import type { PlateName } from "@/lib/plates";

// gravures qui s'encrent autour de l'étiquette : [planche, position, largeur, délai, rotation]
const SPRIGS: [PlateName, string, string, number, number][] = [
  ["fougere", "left-[-6vw] bottom-[-8vh]", "w-[34vw] max-w-[460px] min-w-[200px]", 0.1, -6],
  ["violette", "right-[-4vw] top-[4vh]", "w-[26vw] max-w-[380px] min-w-[170px]", 0.35, 8],
  ["pensee", "left-[6vw] top-[-4vh]", "w-[15vw] max-w-[220px] min-w-[110px]", 0.6, -14],
  ["renoncule", "right-[8vw] bottom-[-6vh]", "w-[17vw] max-w-[250px] min-w-[120px]", 0.8, 10],
  ["graminee", "left-[38vw] top-[-10vh]", "w-[9vw] max-w-[130px] min-w-[70px]", 1.0, 18],
  ["brins", "left-[30vw] bottom-[2vh]", "w-[16vw] max-w-[240px] min-w-[120px]", 1.2, -4],
];

/**
 * Film d'ouverture de 5 secondes, plein écran : les gravures s'encrent une à une,
 * la grande violette se dessine au centre puis s'efface derrière l'étiquette noire,
 * qui se déplie et s'imprime lettre à lettre ; enfin le papier se lève sur l'accueil.
 */
export function IntroFilm({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  return (
    <motion.div
      className="h-paper fixed inset-0 z-[100] overflow-hidden"
      initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
      animate={{ clipPath: "inset(0% 0% 100% 0%)" }}
      transition={{ duration: 0.9, ease: [0.77, 0, 0.18, 1], delay: 4.3 }}
      onAnimationComplete={onDone}
      role="presentation"
    >
      {/* fil de temps : un filet qui traverse l'écran pendant tout le film */}
      <motion.span className="absolute left-0 top-0 h-px w-full origin-left bg-ink/40" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 4.3, ease: "linear" }} />

      <motion.div className="absolute inset-0" animate={{ y: ["0%", "0%", "-6%"] }} transition={{ duration: 5.2, times: [0, 0.82, 1], ease: EASE }}>
        {SPRIGS.map(([name, pos, w, delay, rot]) => (
          <motion.div
            key={name}
            className={`absolute text-plum ${pos} ${w}`}
            initial={{ rotate: rot - 6, scale: 0.9 }}
            animate={{ rotate: rot, scale: 1 }}
            transition={{ duration: 4.5, delay, ease: EASE }}
          >
            <Plate name={name} reveal="mount" delay={delay} duration={1.7} opacity={0.85} />
          </motion.div>
        ))}

        {/* la grande violette du centre, qui s'efface quand l'étiquette arrive */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-[min(46vw,420px)] text-ink"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: [1, 1, 0.14], scale: [1, 1, 1.18] }}
            transition={{ duration: 2.6, times: [0, 0.62, 1], ease: EASE }}
          >
            <Plate name="violette" reveal="mount" delay={0.15} duration={1.5} />
          </motion.div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          <Label size="lg" delay={0.75} sheen />
          <motion.p className="sc mt-8 text-ink-muted" initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.22em" }} transition={{ duration: 1.4, delay: 3.1, ease: EASE }}>
            Six-Fours-les-Plages · depuis 2022
          </motion.p>
        </div>
      </motion.div>

      <motion.button
        onClick={onSkip}
        className="sc absolute bottom-7 right-6 z-10 text-ink-muted hover:text-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        Passer
      </motion.button>
    </motion.div>
  );
}
