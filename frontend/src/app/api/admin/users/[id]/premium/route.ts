import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { createNotification } from '@/lib/notifications';
import { grantPremiumAdmin, deactivatePremium } from '@/lib/premium/sync';
import { userToJson } from '@/lib/firebase/wallet';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const { action, months } = await req.json();

    if (action !== 'grant' && action !== 'revoke') {
      return NextResponse.json({ error: 'action doit être grant ou revoke' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('users').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    if (action === 'grant') {
      const durationMonths = Number(months) || 1;
      const expiresAt = await grantPremiumAdmin(db, params.id, durationMonths);

      await createNotification(db, {
        userId: params.id,
        type: 'premium_activated',
        title: 'Premium MILOU offert',
        body: `Un modérateur vous a offert Premium jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}.`,
        link: '/dashboard',
      });

      await logAdminAction(adminId, 'premium_grant_admin', { type: 'user', id: params.id }, {
        months: durationMonths,
        expiresAt: expiresAt.toISOString(),
      });

      const user = userToJson(params.id, (await ref.get()).data()!);
      return NextResponse.json({
        message: `Premium offert pour ${durationMonths} mois`,
        user,
        expiresAt: expiresAt.toISOString(),
      });
    }

    await deactivatePremium(db, params.id);

    const listings = await db.collection('listings').where('userId', '==', params.id).get();
    const batch = db.batch();
    listings.docs.forEach((d) => batch.update(d.ref, { featured: false }));
    if (!listings.empty) await batch.commit();

    await createNotification(db, {
      userId: params.id,
      type: 'system',
      title: 'Premium retiré',
      body: 'Votre accès Premium a été retiré par un modérateur.',
      link: '/premium',
    });

    await logAdminAction(adminId, 'premium_revoke_admin', { type: 'user', id: params.id });

    const user = userToJson(params.id, (await ref.get()).data()!);
    return NextResponse.json({ message: 'Premium retiré', user });
  } catch (err) {
    return adminError(err);
  }
}
