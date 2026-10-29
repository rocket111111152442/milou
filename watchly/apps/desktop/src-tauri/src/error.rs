use serde::Serialize;

/// Erreur renvoyée à l'interface : un code stable (mêmes codes que le serveur) et un message lisible.
#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[error("{code}: {message}")]
pub struct FetchError {
    pub code: &'static str,
    pub message: String,
}

impl FetchError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

impl From<reqwest::Error> for FetchError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            FetchError::new("timeout", "Délai dépassé")
        } else if err.is_connect() {
            FetchError::new("network_error", "Connexion impossible")
        } else if err.is_decode() || err.is_body() {
            FetchError::new("network_error", "Réponse illisible")
        } else {
            FetchError::new("network_error", "Connexion impossible")
        }
    }
}
