export type Role = "user" | "business" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  suspended: boolean;
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function assertRole(user: SessionUser | null, allowed: Role[]): SessionUser {
  if (!user) throw new AuthError(401, "Authentification requise");
  if (user.suspended) throw new AuthError(403, "Compte suspendu");
  if (!allowed.includes(user.role)) throw new AuthError(403, "Accès refusé");
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return Boolean(user && !user.suspended && user.role === "admin");
}
