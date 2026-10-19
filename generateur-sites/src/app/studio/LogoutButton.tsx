"use client";

import { studioLogout } from "./actions";

export function LogoutButton() {
  return (
    <form action={studioLogout}>
      <button type="submit" className="h-10 rounded-full border border-mie bg-creme px-4 text-sm font-semibold transition hover:bg-mie">
        Déconnexion
      </button>
    </form>
  );
}
