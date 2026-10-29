//! Téléchargement des pages surveillées depuis l'ordinateur de l'utilisateur, avec les mêmes
//! protections que le serveur : adresses publiques uniquement (vérifiées après résolution DNS
//! puis « épinglées » pour la connexion), redirections revalidées une par une, taille et durée
//! bornées, aucun cookie ni identifiant transmis.

use std::net::{IpAddr, SocketAddr};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, CONTENT_LENGTH, CONTENT_TYPE, LOCATION, USER_AGENT};
use serde::Serialize;
use url::{Host, Url};

use crate::error::FetchError;
use crate::url_policy::{parse_target_url, Policy};

pub const MAX_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_REDIRECTS: u8 = 5;
pub const TIMEOUT: Duration = Duration::from_secs(20);
pub const AGENT: &str = "WatchlyBot/0.1 (+https://watchly.lullin-web.com/robot; application desktop)";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Purpose {
    /// Page surveillée : HTML, texte ou JSON.
    Page,
    /// Fichier robots.txt.
    Robots,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResponse {
    pub url: String,
    pub final_url: String,
    pub status: u16,
    pub content_type: String,
    pub body: String,
    pub truncated: bool,
    pub redirects: u8,
    pub duration_ms: u64,
}

fn allowed_content_type(ct: &str, purpose: Purpose) -> bool {
    if ct.is_empty() {
        return true;
    }
    let base = ct.split(';').next().unwrap_or("").trim();
    match purpose {
        Purpose::Robots => base.starts_with("text/"),
        Purpose::Page => matches!(
            base,
            "text/html" | "application/xhtml+xml" | "text/plain" | "application/json" | "application/ld+json"
        ),
    }
}

/// Résout le nom et refuse si UNE SEULE des adresses n'est pas publique (anti « DNS rebinding »).
async fn resolve_public(url: &Url, policy: Policy) -> Result<Vec<SocketAddr>, FetchError> {
    let port = url.port_or_known_default().unwrap_or(443);
    let ips: Vec<IpAddr> = match url.host() {
        Some(Host::Ipv4(v4)) => vec![IpAddr::V4(v4)],
        Some(Host::Ipv6(v6)) => vec![IpAddr::V6(v6)],
        Some(Host::Domain(d)) => {
            let found = tokio::time::timeout(Duration::from_secs(8), tokio::net::lookup_host((d, port)))
                .await
                .map_err(|_| FetchError::new("dns_error", "Nom de domaine introuvable"))?
                .map_err(|_| FetchError::new("dns_error", "Nom de domaine introuvable"))?;
            found.map(|a| a.ip()).collect()
        }
        None => return Err(FetchError::new("invalid_url", "Adresse invalide")),
    };
    if ips.is_empty() {
        return Err(FetchError::new("dns_error", "Nom de domaine introuvable"));
    }
    if ips.iter().any(|ip| !policy.ip_allowed(*ip)) {
        return Err(FetchError::new("blocked_address", "Adresse privée ou réservée refusée"));
    }
    Ok(ips.into_iter().map(|ip| SocketAddr::new(ip, port)).collect())
}

fn client_for(url: &Url, addrs: &[SocketAddr]) -> Result<reqwest::Client, FetchError> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(AGENT));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.1"),
    );
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("fr-FR,fr;q=0.9,en;q=0.6"));
    let mut builder = reqwest::Client::builder()
        .default_headers(headers)
        // Le proxy système contournerait l'épinglage de l'adresse IP validée.
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(TIMEOUT)
        .connect_timeout(Duration::from_secs(10))
        .pool_max_idle_per_host(0)
        .https_only(false);
    if let Some(Host::Domain(d)) = url.host() {
        builder = builder.resolve_to_addrs(d, addrs);
    }
    builder.build().map_err(|_| FetchError::new("network_error", "Initialisation réseau impossible"))
}

/// Décode le corps selon le charset déclaré (en-tête, puis balise meta), UTF-8 par défaut.
pub fn decode_body(bytes: &[u8], content_type: &str) -> String {
    let from_header = content_type
        .split(';')
        .filter_map(|p| p.trim().strip_prefix("charset="))
        .next()
        .map(|c| c.trim_matches(|ch| ch == '"' || ch == '\'').to_string());
    let label = from_header.or_else(|| {
        let head = String::from_utf8_lossy(&bytes[..bytes.len().min(2048)]).to_ascii_lowercase();
        let idx = head.find("charset=")?;
        let rest = head[idx + 8..].trim_start_matches(['"', '\'']);
        let end = rest.find(|c: char| !(c.is_ascii_alphanumeric() || c == '-' || c == '_')).unwrap_or(rest.len());
        Some(rest[..end].to_string())
    });
    let encoding = label
        .and_then(|l| encoding_rs::Encoding::for_label(l.as_bytes()))
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = encoding.decode(bytes);
    text.into_owned()
}

pub async fn safe_fetch(input: &str, purpose: Purpose, policy: Policy) -> Result<FetchResponse, FetchError> {
    let started = Instant::now();
    let original = parse_target_url(input, policy)?;
    let mut current = original.clone();
    let mut redirects: u8 = 0;
    loop {
        let addrs = resolve_public(&current, policy).await?;
        let client = client_for(&current, &addrs)?;
        let res = client.get(current.clone()).send().await?;
        let status = res.status().as_u16();

        if matches!(status, 301 | 302 | 303 | 307 | 308) {
            if redirects >= MAX_REDIRECTS {
                return Err(FetchError::new("too_many_redirects", "Trop de redirections"));
            }
            let location = res
                .headers()
                .get(LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| FetchError::new("network_error", "Redirection sans destination"))?;
            let next = current
                .join(location)
                .map_err(|_| FetchError::new("invalid_url", "Redirection invalide"))?;
            current = parse_target_url(next.as_str(), policy)
                .map_err(|e| FetchError::new(e.code, format!("Redirection refusée : {}", e.message)))?;
            redirects += 1;
            continue;
        }

        let content_type = res
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !allowed_content_type(&content_type, purpose) {
            let base = content_type.split(';').next().unwrap_or("").to_string();
            return Err(FetchError::new("unsupported_content", format!("Type de contenu non pris en charge ({base})")));
        }
        let declared = res
            .headers()
            .get(CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(0);
        if declared > MAX_BYTES * 4 {
            return Err(FetchError::new("too_large", "Page trop volumineuse"));
        }

        // Le corps est lu décompressé et coupé à MAX_BYTES (protection contre les « bombes » gzip).
        let mut body: Vec<u8> = Vec::with_capacity(declared.min(MAX_BYTES));
        let mut truncated = false;
        let mut stream = res.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            let room = MAX_BYTES - body.len();
            if chunk.len() > room {
                body.extend_from_slice(&chunk[..room]);
                truncated = true;
                break;
            }
            body.extend_from_slice(&chunk);
        }

        return Ok(FetchResponse {
            url: original.to_string(),
            final_url: current.to_string(),
            status,
            body: decode_body(&body, &content_type),
            content_type,
            truncated,
            redirects,
            duration_ms: started.elapsed().as_millis() as u64,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const LOCAL: Policy = Policy { allow_loopback: true, allow_any_port: true };

    /// Petit serveur HTTP de test : chaque connexion reçoit la réponse calculée à partir du chemin.
    async fn serve(handler: fn(&str, u16) -> Vec<u8>) -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                let Ok((mut sock, _)) = listener.accept().await else { break };
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 8192];
                    let n = sock.read(&mut buf).await.unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]).to_string();
                    let path = req.split_whitespace().nth(1).unwrap_or("/").to_string();
                    let _ = sock.write_all(&handler(&path, port)).await;
                    let _ = sock.shutdown().await;
                });
            }
        });
        port
    }

    fn response(status: &str, headers: &[(&str, String)], body: &[u8]) -> Vec<u8> {
        let mut out = format!("HTTP/1.1 {status}\r\nconnection: close\r\ncontent-length: {}\r\n", body.len()).into_bytes();
        for (k, v) in headers {
            out.extend_from_slice(format!("{k}: {v}\r\n").as_bytes());
        }
        out.extend_from_slice(b"\r\n");
        out.extend_from_slice(body);
        out
    }

    fn handler(path: &str, port: u16) -> Vec<u8> {
        match path {
            "/produit" => response("200 OK", &[("content-type", "text/html; charset=utf-8".into())], "<h1>Casque</h1><p>129,99 €</p>".as_bytes()),
            "/latin1" => response("200 OK", &[("content-type", "text/html; charset=iso-8859-1".into())], b"<p>Pr\xe9commande</p>"),
            "/meta" => response("200 OK", &[("content-type", "text/html".into())], b"<meta charset=\"windows-1252\"><p>\x80 9</p>"),
            "/redirige" => response("302 Found", &[("location", format!("http://127.0.0.1:{port}/produit"))], b""),
            "/vers-prive" => response("302 Found", &[("location", "http://10.0.0.1/admin".into())], b""),
            "/vers-fichier" => response("302 Found", &[("location", "file:///etc/passwd".into())], b""),
            "/boucle" => response("302 Found", &[("location", "/boucle".into())], b""),
            "/image" => response("200 OK", &[("content-type", "image/png".into())], b"\x89PNG"),
            "/enorme" => response("200 OK", &[("content-type", "text/plain".into())], &vec![b'a'; MAX_BYTES + 10]),
            "/gzip" => {
                let mut enc = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::best());
                enc.write_all(&vec![b'z'; 20 * 1024 * 1024]).unwrap();
                let gz = enc.finish().unwrap();
                response("200 OK", &[("content-type", "text/plain".into()), ("content-encoding", "gzip".into())], &gz)
            }
            _ => response("404 Not Found", &[("content-type", "text/plain".into())], b"absent"),
        }
    }

    #[tokio::test]
    async fn fetches_and_decodes() {
        let port = serve(handler).await;
        let r = safe_fetch(&format!("http://127.0.0.1:{port}/produit"), Purpose::Page, LOCAL).await.unwrap();
        assert_eq!(r.status, 200);
        assert!(r.body.contains("129,99 €"));
        let r = safe_fetch(&format!("http://127.0.0.1:{port}/latin1"), Purpose::Page, LOCAL).await.unwrap();
        assert!(r.body.contains("Précommande"));
        let r = safe_fetch(&format!("http://127.0.0.1:{port}/meta"), Purpose::Page, LOCAL).await.unwrap();
        assert!(r.body.contains("€ 9"));
    }

    #[tokio::test]
    async fn follows_and_revalidates_redirects() {
        let port = serve(handler).await;
        let r = safe_fetch(&format!("http://127.0.0.1:{port}/redirige"), Purpose::Page, LOCAL).await.unwrap();
        assert_eq!(r.redirects, 1);
        assert!(r.final_url.ends_with("/produit"));
        let e = safe_fetch(&format!("http://127.0.0.1:{port}/vers-prive"), Purpose::Page, LOCAL).await.unwrap_err();
        assert_eq!(e.code, "blocked_host");
        let e = safe_fetch(&format!("http://127.0.0.1:{port}/vers-fichier"), Purpose::Page, LOCAL).await.unwrap_err();
        assert_eq!(e.code, "unsupported_protocol");
        let e = safe_fetch(&format!("http://127.0.0.1:{port}/boucle"), Purpose::Page, LOCAL).await.unwrap_err();
        assert_eq!(e.code, "too_many_redirects");
    }

    #[tokio::test]
    async fn enforces_type_and_size_limits() {
        let port = serve(handler).await;
        let e = safe_fetch(&format!("http://127.0.0.1:{port}/image"), Purpose::Page, LOCAL).await.unwrap_err();
        assert_eq!(e.code, "unsupported_content");
        let r = safe_fetch(&format!("http://127.0.0.1:{port}/enorme"), Purpose::Page, LOCAL).await.unwrap();
        assert!(r.truncated);
        assert_eq!(r.body.len(), MAX_BYTES);
        let r = safe_fetch(&format!("http://127.0.0.1:{port}/gzip"), Purpose::Page, LOCAL).await.unwrap();
        assert!(r.truncated, "le corps décompressé doit être borné");
        assert_eq!(r.body.len(), MAX_BYTES);
    }

    #[tokio::test]
    async fn strict_policy_refuses_loopback_even_via_dns() {
        let port = serve(handler).await;
        let e = safe_fetch(&format!("http://127.0.0.1:{port}/produit"), Purpose::Page, Policy::strict()).await.unwrap_err();
        assert_eq!(e.code, "blocked_port");
        let relaxed_port = Policy { allow_loopback: false, allow_any_port: true };
        let e = safe_fetch(&format!("http://127.0.0.1:{port}/produit"), Purpose::Page, relaxed_port).await.unwrap_err();
        assert_eq!(e.code, "blocked_host");
        // Contrôle après résolution DNS : un nom qui pointe vers une adresse locale est refusé.
        let url = Url::parse(&format!("http://localhost:{port}/")).unwrap();
        let e = resolve_public(&url, relaxed_port).await.unwrap_err();
        assert_eq!(e.code, "blocked_address");
    }

    #[test]
    fn robots_purpose_accepts_text_only() {
        assert!(allowed_content_type("text/plain; charset=utf-8", Purpose::Robots));
        assert!(!allowed_content_type("application/json", Purpose::Robots));
        assert!(allowed_content_type("application/json", Purpose::Page));
        assert!(!allowed_content_type("application/pdf", Purpose::Page));
    }
}
