import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdmin, adminError } from '@/lib/firebase/admin-guard';
import { tsToIso, userToJson } from '@/lib/firebase/wallet';
import { jsonNoStore } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const status = req.nextUrl.searchParams.get('status') || 'pending';

    const snap = await getAdminDb().collection('review_reports').limit(100).get();

    const reports = await Promise.all(
      snap.docs
        .filter((d) => !status || d.data().status === status)
        .map(async (d) => {
          const data = d.data();
          const reporterSnap = await getAdminDb().collection('users').doc(data.reporterId).get();
          const reporter = reporterSnap.exists
            ? userToJson(reporterSnap.id, reporterSnap.data()!)
            : null;
          return {
            _id: d.id,
            reviewId: data.reviewId,
            reporterId: data.reporterId,
            reason: data.reason,
            details: data.details,
            status: data.status,
            reviewSnapshot: data.reviewSnapshot,
            reporter,
            createdAt: tsToIso(data.createdAt),
          };
        })
    );

    reports.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return jsonNoStore({ reports });
  } catch (err) {
    return adminError(err);
  }
}
