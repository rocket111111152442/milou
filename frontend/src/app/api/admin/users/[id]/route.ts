import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError, logAdminAction } from '@/lib/firebase/admin-guard';
import { userToJson, tsToIso } from '@/lib/firebase/wallet';

async function userBrief(db: ReturnType<typeof getAdminDb>, uid: string) {
  const snap = await db.collection('users').doc(uid).get();
  const u = snap.data();
  if (!u) return { firstname: '?', lastname: '', email: '' };
  return { firstname: u.firstname, lastname: u.lastname, email: u.email };
}

async function mapMissionDoc(db: ReturnType<typeof getAdminDb>, d: QueryDocumentSnapshot) {
  const data = d.data();
  const client = await userBrief(db, data.clientId);
  const provider = await userBrief(db, data.providerId);
  return {
    _id: d.id,
    ...data,
    clientId: client,
    providerId: provider,
    createdAt: tsToIso(data.createdAt),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(params.id).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const user = userToJson(userSnap.id, userSnap.data()!);

    let auth = {
      emailVerified: false,
      disabled: false,
      lastSignIn: null as string | null,
      creationTime: null as string | null,
    };
    try {
      const rec = await getAdminAuth().getUser(params.id);
      auth = {
        emailVerified: rec.emailVerified,
        disabled: rec.disabled,
        lastSignIn: rec.metadata.lastSignInTime || null,
        creationTime: rec.metadata.creationTime || null,
      };
    } catch {
      /* auth record may be missing */
    }

    const [txFrom, txTo, listingsSnap, clientMissions, providerMissions] = await Promise.all([
      db.collection('transactions').where('fromUserId', '==', params.id).limit(50).get(),
      db.collection('transactions').where('toUserId', '==', params.id).limit(50).get(),
      db.collection('listings').where('userId', '==', params.id).get(),
      db.collection('missions').where('clientId', '==', params.id).get(),
      db.collection('missions').where('providerId', '==', params.id).get(),
    ]);

    const txMap = new Map<string, Record<string, unknown>>();
    [...txFrom.docs, ...txTo.docs].forEach((d) => {
      txMap.set(d.id, { _id: d.id, ...d.data(), createdAt: tsToIso(d.data().createdAt) });
    });
    const transactions = Array.from(txMap.values()).sort(
      (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
    );

    const listings = listingsSnap.docs.map((d) => ({
      _id: d.id,
      ...d.data(),
      createdAt: tsToIso(d.data().createdAt),
    }));

    const missionsAsClient = await Promise.all(
      clientMissions.docs.map((d) => mapMissionDoc(db, d))
    );
    const missionsAsProvider = await Promise.all(
      providerMissions.docs.map((d) => mapMissionDoc(db, d))
    );

    return NextResponse.json({
      user,
      auth,
      transactions,
      listings,
      missionsAsClient,
      missionsAsProvider,
      counts: {
        listings: listings.length,
        missions: missionsAsClient.length + missionsAsProvider.length,
        transactions: transactions.length,
      },
    });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    const body = await req.json();
    const db = getAdminDb();
    const ref = db.collection('users').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.firstname !== undefined) updates.firstname = String(body.firstname).trim();
    if (body.lastname !== undefined) updates.lastname = String(body.lastname).trim();
    if (body.reputation !== undefined) updates.reputation = Number(body.reputation);
    if (body.moderatorNotes !== undefined) updates.moderatorNotes = String(body.moderatorNotes);
    if (body.role !== undefined) {
      if (!['user', 'admin', 'moderator'].includes(body.role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.status !== undefined) {
      if (!['active', 'suspended', 'banned'].includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
      }
      updates.status = body.status;
      if (body.status === 'suspended' || body.status === 'banned') {
        updates.suspendedAt = FieldValue.serverTimestamp();
      } else {
        updates.suspendedAt = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    await ref.update(updates);

    if (body.status === 'banned' || body.status === 'suspended') {
      try {
        await getAdminAuth().updateUser(params.id, { disabled: true });
      } catch {
        /* ignore */
      }
    } else if (body.status === 'active') {
      try {
        await getAdminAuth().updateUser(params.id, { disabled: false });
      } catch {
        /* ignore */
      }
    }

    await logAdminAction(adminId, 'user_update', { type: 'user', id: params.id }, updates);

    const user = userToJson(params.id, (await ref.get()).data()!);
    return NextResponse.json({ user });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = await requireAdmin(req);
    if (adminId === params.id) {
      return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
    }

    const db = getAdminDb();
    const listings = await db.collection('listings').where('userId', '==', params.id).get();
    const batch = db.batch();
    listings.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection('users').doc(params.id));
    await batch.commit();
    try {
      await getAdminAuth().deleteUser(params.id);
    } catch {
      /* ignore */
    }

    await logAdminAction(adminId, 'user_delete', { type: 'user', id: params.id });

    return NextResponse.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    return adminError(err);
  }
}
