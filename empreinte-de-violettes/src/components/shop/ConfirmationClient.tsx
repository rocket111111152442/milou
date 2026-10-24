"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { EASE } from "@/components/herbier/Elements";
import { Plate } from "@/components/herbier/Plate";
import { useCart } from "@/store/cart";

/** Remerciement : la violette s'encre, puis le mot. Le panier est vidé après paiement. */
export function ConfirmationHero({ name, number, paid, pending }: { name: string; number: string; paid: string; pending: boolean }) {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    if (!pending) clear();
  }, [clear, pending]);
  return (
    <div className="wrap flex flex-col items-center pb-14 pt-28 text-center sm:pt-36">
      <Plate name="violette" reveal="mount" duration={2.4} className="w-[min(240px,55vw)] text-plum" />
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="sc mt-10 text-ink-muted">
        Commande <span className="tab">{number}</span>
      </motion.p>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 1.1, ease: EASE }} className="h-title mt-5">
        {pending ? (
          <>
            Paiement <em className="text-plum">en cours…</em>
          </>
        ) : (
          <>
            Merci, <em className="text-plum">{name}.</em>
          </>
        )}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="body-text mx-auto mt-6 max-w-xl">
        {pending
          ? "Nous attendons la confirmation de Stripe. Cette page se met à jour d'elle-même ; vous recevrez aussi un e-mail."
          : `Votre commande est confirmée${paid}. Un récapitulatif vient de partir par e-mail ; la fleuriste prépare déjà vos fleurs.`}
      </motion.p>
    </div>
  );
}
