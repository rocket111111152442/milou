/**
 * Politique d'adresses IP autorisées pour les requêtes sortantes (protection SSRF).
 * Seules les adresses « unicast » publiques sont acceptées : loopback, réseaux privés,
 * link-local (dont 169.254.169.254, métadonnées cloud), CGNAT, multicast, plages réservées,
 * ULA IPv6, NAT64 / 6to4 / Teredo (qui peuvent encapsuler une IPv4 privée) sont refusés.
 */
import ipaddr from "ipaddr.js";

export interface IpPolicyOptions {
  /** Tests uniquement : autorise 127.0.0.0/8 et ::1. Interdit en production. */
  allowLoopback?: boolean;
}

export function isPublicAddress(address: string, opts: IpPolicyOptions = {}): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }
  const range = parsed.range();
  if (opts.allowLoopback && range === "loopback") return true;
  return range === "unicast";
}

export class BlockedAddressError extends Error {
  readonly code = "blocked_address";
  constructor(public readonly host: string) {
    super(`Adresse non autorisée pour ${host}`);
    this.name = "BlockedAddressError";
  }
}
