/** Lecture sommaire d'un User-Agent pour la liste des sessions (navigateur et système). Aucune bibliothèque, aucune donnée envoyée. */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return os ? `${browser} sur ${os}` : browser;
}
