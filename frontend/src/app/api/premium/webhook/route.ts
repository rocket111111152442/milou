import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase/admin';
import { createNotification } from '@/lib/notifications';
import { activatePremium, deactivatePremium } from '@/lib/premium/sync';
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe';

export const runtime = 'nodejs';

async function uidFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  return sub.metadata?.firebaseUid || null;
}

async function uidFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  return session.metadata?.firebaseUid || session.client_reference_id || null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, getStripeWebhookSecret());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook invalide' },
      { status: 400 }
    );
  }

  const db = getAdminDb();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const uid = await uidFromSession(session);
        if (!uid) break;

        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        let expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(subId);
          expiresAt = new Date(sub.current_period_end * 1000);
          await activatePremium(db, uid, expiresAt, String(session.customer || ''), subId);
        } else {
          await activatePremium(db, uid, expiresAt, String(session.customer || ''));
        }

        await createNotification(db, {
          userId: uid,
          type: 'premium_activated',
          title: 'Premium MILOU activé',
          body: 'Vos avantages Premium sont débloqués. Merci pour votre confiance !',
          link: '/dashboard',
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (!subId) break;
        const sub = await getStripe().subscriptions.retrieve(subId);
        const uid = await uidFromSubscription(sub);
        if (!uid) break;
        const expiresAt = new Date(sub.current_period_end * 1000);
        await activatePremium(db, uid, expiresAt, String(sub.customer), subId);
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const uid = await uidFromSubscription(sub);
        if (!uid) break;
        if (sub.status === 'active' || sub.status === 'trialing') {
          await activatePremium(db, uid, new Date(sub.current_period_end * 1000), String(sub.customer), sub.id);
        } else if (['canceled', 'unpaid', 'past_due'].includes(sub.status)) {
          await deactivatePremium(db, uid);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
