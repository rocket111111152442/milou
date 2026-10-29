//! Appels vers l'API Watchly. Le jeton d'appareil reste dans ce processus : l'interface ne le
//! voit jamais et ne peut joindre que les chemins `/api/` du serveur Watchly configuré.

use std::time::Duration;

use reqwest::Method;
use serde::Serialize;
use serde_json::Value;

/// Adresse du serveur. Fixée à la compilation (WATCHLY_API_URL) ; en développement seulement,
/// elle peut être remplacée par la variable d'environnement du même nom.
pub fn api_base() -> String {
    if cfg!(debug_assertions) {
        if let Ok(v) = std::env::var("WATCHLY_API_URL") {
            return v.trim_end_matches('/').to_string();
        }
    }
    option_env!("WATCHLY_API_URL").unwrap_or("http://localhost:3000").trim_end_matches('/').to_string()
}

pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!("Watchly-Desktop/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .https_only(!cfg!(debug_assertions) && option_env!("WATCHLY_ALLOW_INSECURE_API") != Some("1"))
        .build()
        .expect("client HTTP")
}

/// N'autorise que des chemins d'API simples, sans remontée ni changement d'hôte.
pub fn valid_api_path(path: &str) -> bool {
    path.starts_with("/api/")
        && path.len() <= 512
        && !path.contains("..")
        && !path.contains("//")
        && !path.contains('\\')
        && path.chars().all(|c| c.is_ascii_alphanumeric() || "/-_.?=&%:".contains(c))
}

pub fn parse_method(method: &str) -> Option<Method> {
    match method {
        "GET" => Some(Method::GET),
        "POST" => Some(Method::POST),
        "PATCH" => Some(Method::PATCH),
        "DELETE" => Some(Method::DELETE),
        _ => None,
    }
}

#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub status: u16,
    pub body: Value,
}

pub async fn call(
    client: &reqwest::Client,
    base: &str,
    method: Method,
    path: &str,
    token: Option<&str>,
    body: Option<&Value>,
) -> Result<ApiResponse, String> {
    let mut req = client.request(method, format!("{base}{path}")).header("accept", "application/json");
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    if let Some(b) = body {
        req = req.json(b);
    }
    let res = req.send().await.map_err(|e| {
        if e.is_timeout() {
            "Le serveur Watchly ne répond pas (délai dépassé).".to_string()
        } else {
            "Serveur Watchly injoignable. Vérifiez votre connexion Internet.".to_string()
        }
    })?;
    let status = res.status().as_u16();
    let text = res.text().await.unwrap_or_default();
    let body = serde_json::from_str(&text).unwrap_or(Value::Null);
    Ok(ApiResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_paths_are_restricted() {
        assert!(valid_api_path("/api/monitors"));
        assert!(valid_api_path("/api/monitors/2b1c7f0e-0000-4000-8000-000000000000/pause"));
        assert!(valid_api_path("/api/notifications?unread=1&limit=20"));
        assert!(!valid_api_path("/app/parametres"));
        assert!(!valid_api_path("/api/../auth/callback"));
        assert!(!valid_api_path("/api//evil.example"));
        assert!(!valid_api_path("https://evil.example/api/x"));
        assert!(!valid_api_path("/api/x\\y"));
        assert!(!valid_api_path("/api/x#frag"));
        assert!(!valid_api_path("/api/x y"));
        assert!(parse_method("PUT").is_none());
        assert!(parse_method("GET").is_some());
    }
}
