// Appels à l'API : session par cookie HttpOnly, en-tête anti-CSRF, erreurs lisibles
export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, raw = false, headers = {} } = {}) {
  const isBlob = body instanceof Blob;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'x-requested-with': 'aei',
      ...(body !== undefined && !isBlob ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body),
  });
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(res.status, data.error || `Erreur ${res.status}`, data);
  }
  return data;
}
