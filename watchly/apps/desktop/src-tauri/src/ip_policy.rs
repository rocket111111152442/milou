//! Politique d'adresses (anti-SSRF) — miroir de packages/monitoring/src/net/ip-policy.ts.
//! Seules les adresses unicast publiques sont autorisées : l'application ne peut pas être utilisée
//! pour explorer le réseau local de l'utilisateur (box, imprimante, NAS, services internes).
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

fn v4_is_public(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_multicast()
        || ip.is_broadcast()
        || ip.is_documentation()
        || o[0] == 0
        || (o[0] == 100 && (64..=127).contains(&o[1])) // CGNAT 100.64.0.0/10
        || (o[0] == 192 && o[1] == 0 && o[2] == 0) // 192.0.0.0/24
        || (o[0] == 198 && (18..=19).contains(&o[1])) // benchmarking
        || o[0] >= 240 // réservé + broadcast
        || (o[0] == 192 && o[1] == 88 && o[2] == 99))
}

fn v6_is_public(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return v4_is_public(v4);
    }
    let s = ip.segments();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        || (s[0] & 0xfe00) == 0xfc00 // ULA fc00::/7
        || (s[0] & 0xffc0) == 0xfe80 // link-local fe80::/10
        || (s[0] & 0xffc0) == 0xfec0 // site-local (obsolète)
        || (s[0] == 0x64 && s[1] == 0xff9b) // NAT64
        || s[0] == 0x2002 // 6to4
        || (s[0] == 0x2001 && s[1] == 0x0000) // Teredo
        || (s[0] == 0x2001 && s[1] == 0x0db8) // documentation
        || (s[0] == 0x0100 && s[1] == 0 && s[2] == 0 && s[3] == 0) // discard
        || s[0] == 0) // ::/16 (compatibles IPv4, etc.)
}

pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4_is_public(v4),
        IpAddr::V6(v6) => v6_is_public(v6),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_private_and_special_ranges() {
        for s in [
            "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
            "224.0.0.1", "255.255.255.255", "192.0.2.1", "198.18.0.1", "240.0.0.1", "::1", "::", "fc00::1",
            "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:db8::1",
        ] {
            assert!(!is_public(s.parse().unwrap()), "{s} should be blocked");
        }
    }
    #[test]
    fn accepts_public() {
        for s in ["93.184.216.34", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"] {
            assert!(is_public(s.parse().unwrap()), "{s} should be allowed");
        }
    }
}
