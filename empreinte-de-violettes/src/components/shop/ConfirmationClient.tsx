"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { Petals } from "@/components/motion/Petals";
import { VioletMark } from "@/components/site/Logo";
import { useCart } from "@/store/cart";

/** Éclosion de la violette + vidage du panier après paiement. */
export function ConfirmationHero({ name, number, paid, pending }: { name: string; number: string; paid: string; pending: boolean }) {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    if (!pending) clear();
  }, [clear, pending]);
  return (
    <div className="relative overflow-hidden pb-12 pt-44 text-center">
      <Petals count={40} />
      <motion.div initial={{ scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 90, damping: 12, delay: 0.2 }} className="relative mx-auto w-fit">
        <span className="absolute inset-0 -m-6 rounded-full bg-gold/20 blur-2xl" />
        <VioletMark className="relative h-24 w-24 text-gold" strokeWidth={1.1} />
      </motion.div>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="eyebrow relative mt-10 text-gold">
        Commande {number}
      </motion.p>
      <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 1, ease: [0.22, 1, 0.36, 1] }} className="h-display relative mt-5 text-[clamp(3rem,7vw,6.5rem)]">
        {pending ? "Paiement en cours…" : <>Merci, <em className="text-foil">{name}</em></>}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="relative mx-auto mt-6 max-w-xl text-ivory/65">
        {pending
          ? "Nous attendons la confirmation de Stripe. Cette page se met à jour dès réception — vous recevrez aussi un e-mail."
          : `Votre commande est confirmée${paid}. Un e-mail récapitulatif vient de vous être envoyé ; la fleuriste prépare déjà vos fleurs.`}
      </motion.p>
    </div>
  );
}
