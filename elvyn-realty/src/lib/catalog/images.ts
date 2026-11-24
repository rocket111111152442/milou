/**
 * AlterEstate serves images through a resizing CDN:
 *   https://assets.alterestate.com/fit-in/{W}x{H}/filters:quality(70)/static/<path>
 * We rebuild URLs at the size we need instead of re-optimising them on our side.
 */
const STATIC_RE = /\/static\/(.+)$/;

export function aeImageUrl(url: string | null | undefined, width: number, height?: number): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return url; // photos of listings added in the CRM (served by this site)
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "assets.alterestate.com" && u.hostname !== "d2p0bx8wfdkjkb.cloudfront.net") return url;
  const m = u.pathname.match(STATIC_RE);
  if (!m) return url;
  const h = height ?? Math.round(width * 0.75);
  return `https://assets.alterestate.com/fit-in/${width}x${h}/filters:quality(72)/filters:format(webp)/static/${m[1]}`;
}

export function isAeImage(src: string): boolean {
  return src.startsWith("https://assets.alterestate.com/") || src.startsWith("https://d2p0bx8wfdkjkb.cloudfront.net/");
}
