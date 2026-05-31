'use client';

import { useState } from 'react';
import { listingsApi } from '@/lib/api';

export default function ListingImageUpload({
  images,
  onChange,
  max = 5,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || images.length >= max) return;
    setUploading(true);
    try {
      const { url } = await listingsApi.uploadImage(file);
      onChange([...images, url]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload impossible');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="label">Photos ({images.length}/{max})</label>
      <div className="flex flex-wrap gap-2">
        {images.map((url) => (
          <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-0 right-0 bg-black/70 text-white text-xs px-1"
              onClick={() => onChange(images.filter((u) => u !== url))}
            >
              ×
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex items-center justify-center cursor-pointer text-xs text-zinc-500 hover:border-indigo-500/50">
            {uploading ? '…' : '+'}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}
