"use client";

import { ReactLenis } from "lenis/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ReactLenis root options={{ lerp: 0.11, anchors: { offset: -80 }, prevent: (node) => node.closest("[data-lenis-prevent]") !== null }}>
        {children}
      </ReactLenis>
    </MotionConfig>
  );
}
