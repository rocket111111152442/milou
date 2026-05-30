import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const snap = await getAdminDb().collection('users').doc(params.id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }
    const email = String(snap.data()?.email ?? '');
    if (!email) {
      return NextResponse.json({ error: 'E-mail manquant' }, { status: 400 });
    }

    const link = await getAdminAuth().generatePasswordResetLink(email);
    await logAdminAction(adminId, 'password_reset_link', { type: 'user', id: params.id }, { email });

    return NextResponse.json({ message: 'Lien de réinitialisation généré', resetLink: link });
  } catch (err) {
    return adminError(err);
  }
}
