const tracking = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|igshid|yclid)$/i;
const sensitive = /^(?:.*(?:token|secret|password|credential|session|signature).*|auth|code|key|sig)$/i;

/** Match Waverti's target canonicalization, with stricter recurring-browser eligibility. */
export function monitoringUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash ||
        !host.includes(".") || host.includes(":") || /^[\d.]+$/.test(host) ||
        /(?:^|\.)(?:localhost|local|internal|lan|home|onion)\.?$/i.test(host)) return null;
    for (const key of url.searchParams.keys()) if (sensitive.test(key)) return null;
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    return url;
  } catch {
    return null;
  }
}

export async function monitoringHash(url) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url.href));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}
