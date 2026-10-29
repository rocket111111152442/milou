"use client";
import { Printer } from "lucide-react";
import { Button } from "@watchly/ui";

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" className="print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden="true" /> Imprimer / PDF
    </Button>
  );
}
