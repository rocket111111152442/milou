use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::store::{Backend, TokenStore};
use crate::url_policy::Policy;

/// Préférences locales (non sensibles), enregistrées dans le dossier de configuration.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalSettings {
    /// Pause des contrôles locaux décidée par l'utilisateur.
    pub paused: bool,
    /// Le message « Waverti reste actif dans la zone de notification » a déjà été montré.
    pub close_hint_shown: bool,
}

pub struct AppState {
    pub store: TokenStore,
    pub token: Mutex<Option<String>>,
    pub backend: Mutex<Option<Backend>>,
    /// Code de liaison en cours (jamais transmis à l'interface).
    pub device_code: Mutex<Option<String>>,
    pub paused: AtomicBool,
    pub http: reqwest::Client,
    pub api_base: String,
    pub policy: Policy,
    settings_path: PathBuf,
    pub settings: Mutex<LocalSettings>,
}

impl AppState {
    pub fn new(data_dir: PathBuf, config_dir: PathBuf) -> Self {
        let store = TokenStore::new(data_dir);
        let loaded = store.load();
        let settings_path = config_dir.join("settings.json");
        let settings: LocalSettings = fs::read_to_string(&settings_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self {
            token: Mutex::new(loaded.as_ref().map(|(t, _)| t.clone())),
            backend: Mutex::new(loaded.map(|(_, b)| b)),
            store,
            device_code: Mutex::new(None),
            paused: AtomicBool::new(settings.paused),
            http: crate::api::http_client(),
            api_base: crate::api::api_base(),
            policy: Policy::from_env(),
            settings_path,
            settings: Mutex::new(settings),
        }
    }

    pub fn token(&self) -> Option<String> {
        self.token.lock().unwrap().clone()
    }

    pub fn set_token(&self, token: &str) -> std::io::Result<Backend> {
        let backend = self.store.save(token)?;
        *self.token.lock().unwrap() = Some(token.to_string());
        *self.backend.lock().unwrap() = Some(backend);
        Ok(backend)
    }

    pub fn clear_token(&self) {
        self.store.clear();
        *self.token.lock().unwrap() = None;
        *self.backend.lock().unwrap() = None;
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn update_settings(&self, f: impl FnOnce(&mut LocalSettings)) {
        let mut s = self.settings.lock().unwrap();
        f(&mut s);
        self.paused.store(s.paused, Ordering::SeqCst);
        if let Some(dir) = self.settings_path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let _ = fs::write(&self.settings_path, serde_json::to_string_pretty(&*s).unwrap_or_default());
    }
}
