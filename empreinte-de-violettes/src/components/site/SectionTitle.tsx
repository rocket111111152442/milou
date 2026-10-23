"use client";

import { motion } from "framer-motion";
import { SplitText } from "@/components/motion/SplitText";
import { cn } from "@/lib/cn";

export function SectionTitle({
  eyebrow,
  title,
  accent,
  align = "left",
  tone = "dark",
  className,
  size = "lg",
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow && (
        <motion.p
          className={cn("eyebrow flex items-center gap-4", align === "center" && "justify-center", tone === "light" ? "text-aubergine-600" : "text-gold")}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
        >
          <span className={cn("h-px w-8", tone === "light" ? "bg-aubergine-600/50" : "bg-gold/60")} />
          {eyebrow}
          {align === "center" && <span className={cn("h-px w-8", tone === "light" ? "bg-aubergine-600/50" : "bg-gold/60")} />}
        </motion.p>
      )}
      <h2 className={cn("h-display mt-5", size === "lg" ? "text-[clamp(2.6rem,6vw,6rem)]" : "text-[clamp(2.2rem,4.4vw,4.2rem)]")}>
        <SplitText text={title} />
        {accent && (
          <>
            {" "}
            <SplitText text={accent} delay={0.15} className="italic" wordClassName="pr-[0.06em]" innerClassName={tone === "light" ? "text-aubergine-600" : "text-gold-light"} />
          </>
        )}
      </h2>
    </div>
  );
}
