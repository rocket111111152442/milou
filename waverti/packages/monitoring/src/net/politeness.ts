/**
 * Espacement minimal entre deux requêtes vers un même hôte (tous utilisateurs confondus),
 * pour ne jamais surcharger un site surveillé.
 */
export class HostPoliteness {
  private next = new Map<string, number>();
  constructor(
    private readonly minGapMs = 5000,
    private readonly maxWaitMs = 30_000,
  ) {}

  /** Réserve un créneau ; attend si nécessaire. Retourne false si l'attente dépasserait maxWaitMs. */
  async acquire(host: string): Promise<boolean> {
    const now = Date.now();
    const slot = Math.max(now, this.next.get(host) ?? 0);
    if (slot - now > this.maxWaitMs) return false;
    this.next.set(host, slot + this.minGapMs);
    if (this.next.size > 50_000) {
      for (const [h, t] of this.next) if (t < now) this.next.delete(h);
    }
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
    return true;
  }
}
