import type { PageObservation } from "@waverti/types";

/** New observations carry explicit evidence; old observations use a conservative fallback. */
export function priceIsReliable(o: PageObservation | null | undefined): boolean {
  if (!o || o.price === null) return false;
  const status = o.fieldEvidence?.price?.status;
  if (status) return status === "verified" || (status === "unavailable" && o.price !== null);
  return o.priceSource !== "text";
}

export function availabilityIsReliable(o: PageObservation | null | undefined): boolean {
  if (!o || o.availability === "unknown") return false;
  const status = o.fieldEvidence?.availability?.status;
  if (status) return status === "verified" || status === "unavailable";
  return true;
}
