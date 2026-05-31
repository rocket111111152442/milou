import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { uploadListingImage } from '@/lib/firebase/storage-admin';

export const runtime = 'nodejs';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const form = await req.formData();
    const file = form.get('file');
    const listingId = String(form.get('listingId') || 'temp');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Format image non supporté (JPG, PNG, WebP, GIF)' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image max 4 Mo' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadListingImage(listingId || uid, {
      buffer,
      name: file.name,
      mimeType: file.type,
    });

    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur upload' },
      { status: 400 }
    );
  }
}
