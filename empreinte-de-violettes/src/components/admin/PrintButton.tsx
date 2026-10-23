"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="adm-btn adm-btn-primary">
      <Printer className="h-4 w-4" /> Imprimer
    </button>
  );
}
