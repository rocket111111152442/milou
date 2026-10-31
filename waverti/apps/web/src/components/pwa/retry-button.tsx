"use client";
import { Button } from "@waverti/ui";

export function RetryButton() {
  return <Button onClick={() => window.location.reload()}>Réessayer</Button>;
}
