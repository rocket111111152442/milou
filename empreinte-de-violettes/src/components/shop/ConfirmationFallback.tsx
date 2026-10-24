"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { ConfirmationHero } from "./ConfirmationClient";
import { OrderSummary } from "./OrderSummary";

/** Affiche la commande depuis la copie locale si le serveur ne la retrouve pas (mode démo sans base). */
export function ConfirmationFallback({ number, token }: { number: string; token: string }) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  useEffect(() => {
    try {
      const o = JSON.parse(sessionStorage.getItem("ev-last-order") || "null") as Order | null;
      setOrder(o && o.number === number && o.accessToken === token ? o : null);
    } catch {
      setOrder(null);
    }
  }, [number, token]);
  if (order === undefined) return <div className="min-h-screen" />;
  if (!order)
    return (
      <div className="wrap flex min-h-[80vh] flex-col items-center justify-center text-center">
        <p className="font-display text-[2.4rem] italic">Commande introuvable.</p>
        <p className="body-text mt-3 max-w-md">Le lien semble incomplet. Vérifiez l&apos;e-mail de confirmation ou contactez-nous.</p>
        <Link href="/suivi" className="btn-line mt-8">
          Suivre une commande <span className="arrow">→</span>
        </Link>
      </div>
    );
  const paid = order.paymentStatus === "in_store" ? " — règlement au retrait" : order.paymentStatus === "demo" ? " (mode démonstration, aucun paiement)" : "";
  return (
    <div className="pb-28">
      <ConfirmationHero name={order.customer.firstName} number={order.number} paid={paid} pending={false} />
      <div className="wrap max-w-3xl">
        <OrderSummary order={order} />
        <div className="mt-10 flex justify-center">
          <Link href="/boutique" className="btn-line">
            Retour à la boutique <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
