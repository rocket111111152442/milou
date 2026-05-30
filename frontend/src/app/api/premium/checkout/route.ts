import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAppBaseUrl, getStripe } from '@/lib/stripe';
import { isPremiumActive } from '@/lib/premium';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: 'STRIPE_PRICE_ID non configuré sur le serveur' }, { status: 500 });
    }

    const userSnap = await getAdminDb().collection('users').doc(uid).get();
    const userData = userSnap.data();
    if (!userData) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }
    if (isPremiumActive(userData)) {
      return NextResponse.json({ error: 'Vous êtes déjà Premium MILOU' }, { status: 400 });
    }

    const base = getAppBaseUrl();
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: String(userData.email),
      client_reference_id: uid,
      metadata: { firebaseUid: uid },
      subscription_data: {
        metadata: { firebaseUid: uid },
      },
      success_url: `${base}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/premium?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur checkout' },
      { status: 400 }
    );
  }
}
