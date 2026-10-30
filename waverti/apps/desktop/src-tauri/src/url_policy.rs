//! Validation des adresses saisies par l'utilisateur, identique à `parseTargetUrl` côté serveur.

use std::net::IpAddr;

use url::{Host, Url};

use crate::error::FetchError;
use crate::ip_policy::is_public;

pub const ALLOWED_PORTS: [u16; 4] = [80, 443, 8080, 8443];
const BLOCKED_SUFFIXES: [&str; 8] = [
    ".localhost",
    ".local",
    ".internal",
    ".intranet",
    ".lan",
    ".home.arpa",
    ".corp",
    ".localdomain",
];

/// Assouplissements réservés aux tests (jamais activables dans une version publiée).
#[derive(Clone, Copy, Debug, Default)]
pub struct Policy {
    pub allow_loopback: bool,
    pub allow_any_port: bool,
}

impl Policy {
    pub fn strict() -> Self {
        Self::default()
    }

    /// En développement uniquement : `WAVERTI_DEV_ALLOW_LOCAL=1` autorise un site de test local.
    pub fn from_env() -> Self {
        if cfg!(debug_assertions) && std::env::var("WAVERTI_DEV_ALLOW_LOCAL").as_deref() == Ok("1") {
            Self { allow_loopback: true, allow_any_port: true }
        } else {
            Self::strict()
        }
    }

    pub fn ip_allowed(&self, ip: IpAddr) -> bool {
        is_public(ip) || (self.allow_loopback && ip.is_loopback())
    }
}

pub fn parse_target_url(input: &str, policy: Policy) -> Result<Url, FetchError> {
    if input.len() > 2048 {
        return Err(FetchError::new("invalid_url", "Adresse invalide"));
    }
    let mut url = Url::parse(input.trim()).map_err(|_| FetchError::new("invalid_url", "Adresse invalide"))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(FetchError::new("unsupported_protocol", "Seules les adresses http et https sont acceptées"));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(FetchError::new("credentials_in_url", "Les identifiants dans l'adresse ne sont pas acceptés"));
    }
    let port = url.port_or_known_default().unwrap_or(0);
    if !policy.allow_any_port && !ALLOWED_PORTS.contains(&port) {
        return Err(FetchError::new("blocked_port", "Port non autorisé (80, 443, 8080 ou 8443 uniquement)"));
    }
    match url.host() {
        Some(Host::Ipv4(v4)) => {
            if !policy.ip_allowed(IpAddr::V4(v4)) {
                return Err(FetchError::new("blocked_host", "Adresse IP privée ou réservée non autorisée"));
            }
        }
        Some(Host::Ipv6(v6)) => {
            if !policy.ip_allowed(IpAddr::V6(v6)) {
                return Err(FetchError::new("blocked_host", "Adresse IP privée ou réservée non autorisée"));
            }
        }
        Some(Host::Domain(d)) => {
            let host = d.trim_end_matches('.').to_ascii_lowercase();
            if host == "localhost" && !policy.allow_loopback {
                return Err(FetchError::new("blocked_host", "Adresse locale non autorisée"));
            }
            if BLOCKED_SUFFIXES.iter().any(|s| host.ends_with(s)) {
                return Err(FetchError::new("blocked_host", "Nom de domaine interne non autorisé"));
            }
            if !host.contains('.') && host != "localhost" {
                return Err(FetchError::new("blocked_host", "Nom de domaine incomplet"));
            }
        }
        None => return Err(FetchError::new("invalid_url", "Adresse invalide")),
    }
    url.set_fragment(None);
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn code(input: &str) -> &'static str {
        parse_target_url(input, Policy::strict()).map(|_| "ok").unwrap_or_else(|e| e.code)
    }

    #[test]
    fn accepts_public_urls() {
        assert_eq!(code("https://www.example.com/produit?id=1#avis"), "ok");
        assert_eq!(code("http://example.com:8080/"), "ok");
        assert_eq!(code("https://93.184.216.34/"), "ok");
        let u = parse_target_url("https://example.com/a#b", Policy::strict()).unwrap();
        assert_eq!(u.fragment(), None);
    }

    #[test]
    fn rejects_dangerous_urls() {
        assert_eq!(code("file:///etc/passwd"), "unsupported_protocol");
        assert_eq!(code("ftp://example.com/"), "unsupported_protocol");
        assert_eq!(code("https://user:pass@example.com/"), "credentials_in_url");
        assert_eq!(code("https://example.com:22/"), "blocked_port");
        assert_eq!(code("http://127.0.0.1/"), "blocked_host");
        assert_eq!(code("http://10.0.0.1/"), "blocked_host");
        assert_eq!(code("http://169.254.169.254/latest/meta-data"), "blocked_host");
        assert_eq!(code("http://[::1]/"), "blocked_host");
        assert_eq!(code("http://[::ffff:192.168.1.1]/"), "blocked_host");
        assert_eq!(code("http://0x7f000001/"), "blocked_host");
        assert_eq!(code("http://2130706433/"), "blocked_host");
        assert_eq!(code("http://localhost/"), "blocked_host");
        assert_eq!(code("http://imprimante.local/"), "blocked_host");
        assert_eq!(code("http://intranet/"), "blocked_host");
        assert_eq!(code("pas une adresse"), "invalid_url");
    }

    #[test]
    fn test_policy_only_relaxes_loopback() {
        let p = Policy { allow_loopback: true, allow_any_port: true };
        assert!(parse_target_url("http://127.0.0.1:4555/", p).is_ok());
        assert!(parse_target_url("http://localhost:4555/", p).is_ok());
        assert!(parse_target_url("http://192.168.1.1/", p).is_err());
    }
}
