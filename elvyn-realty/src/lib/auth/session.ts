import { SignJWT, jwtVerify } from "jose";

/** Edge-compatible session token helpers (used by middleware and server code). */
export const SESSION_COOKIE = "ea_admin";

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: number, hours: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .setAudience("ea-admin")
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<{ uid: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: "ea-admin", algorithms: ["HS256"] });
    return typeof payload.uid === "number" ? { uid: payload.uid } : null;
  } catch {
    return null;
  }
}
