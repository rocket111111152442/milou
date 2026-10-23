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
  if (order === undefined) return <div className="min-h-screen bg-noir" />;
  if (!order)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-noir px-6 text-center">
        <p className="font-display text-4xl italic">Commande introuvable</p>
        <p className="mt-3 max-w-md text-ivory/60">Le lien semble incomplet. Vérifiez l&apos;e-mail de confirmation ou contactez-nous.</p>
        <Link href="/suivi" className="btn btn-ivory mt-8">
          <span>Suivre une commande</span>
        </Link>
      </div>
    );
  const paid = order.paymentStatus === "in_store" ? " — règlement au retrait" : order.paymentStatus === "demo" ? " (mode démonstration, aucun paiement)" : "";
  return (
    <div className="fern-night bg-noir pb-32">
      <ConfirmationHero name={order.customer.firstName} number={order.number} paid={paid} pending={false} />
      <div className="mx-auto max-w-3xl px-6">
        <OrderSummary order={order} />
        <div className="mt-10 flex justify-center">
          <Link href="/boutique" className="btn btn-ghost text-ivory">
            <span>Retour à la boutique</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
