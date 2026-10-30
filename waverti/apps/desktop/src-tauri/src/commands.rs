//! Commandes appelables depuis l'interface. Aucune ne donne accès au jeton d'appareil,
//! au système de fichiers ou à une adresse réseau arbitraire.

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use crate::api::{self, ApiResponse};
use crate::error::FetchError;
use crate::safe_fetch::{safe_fetch, FetchResponse, Purpose};
use crate::state::AppState;
use crate::store::Backend;
use crate::tray;

fn platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: &'static str,
    platform: &'static str,
    api_base: String,
    linked: bool,
    storage: Option<Backend>,
    paused: bool,
    hostname: String,
    updater_available: bool,
    dev_allow_local: bool,
}

#[tauri::command]
pub fn app_info(state: State<'_, AppState>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        platform: platform(),
        api_base: state.api_base.clone(),
        linked: state.token().is_some(),
        storage: *state.backend.lock().unwrap(),
        paused: state.is_paused(),
        hostname: hostname::get().ok().and_then(|h| h.into_string().ok()).unwrap_or_else(|| "Mon ordinateur".into()),
        updater_available: cfg!(feature = "updater"),
        dev_allow_local: state.policy.allow_loopback,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStart {
    user_code: String,
    verification_url: String,
    expires_in: u64,
    interval: u64,
}

/// Démarre la liaison : le code d'appareil reste ici, seul le code court est affiché.
#[tauri::command]
pub async fn link_start(state: State<'_, AppState>, device_name: String) -> Result<LinkStart, String> {
    let body = json!({
        "deviceName": device_name.chars().take(80).collect::<String>(),
        "platform": platform(),
        "appVersion": env!("CARGO_PKG_VERSION"),
    });
    let res = api::call(&state.http, &state.api_base, reqwest::Method::POST, "/api/agent/link/start", None, Some(&body)).await?;
    if res.status != 200 {
        return Err(error_message(&res, "Impossible de démarrer la liaison."));
    }
    let device_code = res.body["deviceCode"].as_str().ok_or("Réponse inattendue du serveur.")?.to_string();
    *state.device_code.lock().unwrap() = Some(device_code);
    Ok(LinkStart {
        user_code: res.body["userCode"].as_str().unwrap_or_default().to_string(),
        verification_url: res.body["verificationUrl"].as_str().unwrap_or_default().to_string(),
        expires_in: res.body["expiresIn"].as_u64().unwrap_or(600),
        interval: res.body["interval"].as_u64().unwrap_or(5),
    })
}

/// Interroge le serveur ; à l'approbation, le jeton est enregistré dans le trousseau.
#[tauri::command]
pub async fn link_poll(state: State<'_, AppState>) -> Result<String, String> {
    let Some(code) = state.device_code.lock().unwrap().clone() else {
        return Ok("invalid".into());
    };
    let body = json!({ "deviceCode": code });
    let res = api::call(&state.http, &state.api_base, reqwest::Method::POST, "/api/agent/link/poll", None, Some(&body)).await?;
    let status = res.body["status"].as_str().unwrap_or("invalid").to_string();
    if status == "approved" {
        let token = res.body["deviceToken"].as_str().ok_or("Réponse inattendue du serveur.")?;
        state.set_token(token).map_err(|_| "Impossible d'enregistrer la liaison sur cet ordinateur.".to_string())?;
        *state.device_code.lock().unwrap() = None;
    } else if matches!(status.as_str(), "expired" | "denied" | "invalid" | "consumed") {
        *state.device_code.lock().unwrap() = None;
    }
    Ok(status)
}

#[tauri::command]
pub fn link_cancel(state: State<'_, AppState>) {
    *state.device_code.lock().unwrap() = None;
}

/// Déliaison : le jeton est révoqué côté serveur (si joignable) puis effacé localement.
#[tauri::command]
pub async fn unlink(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(token) = state.token() {
        let _ = api::call(&state.http, &state.api_base, reqwest::Method::POST, "/api/agent/logout", Some(&token), Some(&json!({}))).await;
    }
    state.clear_token();
    let _ = app.emit("auth://unlinked", ());
    Ok(())
}

/// Appel de l'API Waverti avec le jeton d'appareil (chemins `/api/` uniquement).
#[tauri::command]
pub async fn api_request(
    app: AppHandle,
    state: State<'_, AppState>,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<ApiResponse, String> {
    if !api::valid_api_path(&path) {
        return Err("Chemin d'API refusé.".into());
    }
    let method = api::parse_method(&method).ok_or("Méthode refusée.")?;
    let token = state.token().ok_or("Application non reliée à un compte.")?;
    let res = api::call(&state.http, &state.api_base, method, &path, Some(&token), body.as_ref()).await?;
    if res.status == 401 && res.body["error"] == "invalid_device" {
        // Appareil révoqué depuis le site : la liaison est effacée et l'interface prévenue.
        state.clear_token();
        let _ = app.emit("auth://unlinked", ());
    }
    Ok(res)
}

/// Téléchargement d'une page surveillée, avec les protections anti-SSRF.
#[tauri::command]
pub async fn fetch_page(state: State<'_, AppState>, url: String) -> Result<FetchResponse, FetchError> {
    if state.is_paused() {
        return Err(FetchError::new("paused", "Contrôles locaux en pause"));
    }
    safe_fetch(&url, Purpose::Page, state.policy).await
}

/// Lecture du robots.txt d'un site (uniquement ce chemin).
#[tauri::command]
pub async fn fetch_robots(state: State<'_, AppState>, url: String) -> Result<FetchResponse, FetchError> {
    let parsed = url::Url::parse(&url).map_err(|_| FetchError::new("invalid_url", "Adresse invalide"))?;
    if parsed.path() != "/robots.txt" || parsed.query().is_some() {
        return Err(FetchError::new("invalid_url", "Seul /robots.txt est accepté"));
    }
    safe_fetch(&url, Purpose::Robots, state.policy).await
}

#[tauri::command]
pub fn set_paused(app: AppHandle, paused: bool) {
    tray::set_paused(&app, paused);
}

#[tauri::command]
pub fn report_status(app: AppHandle, text: String) {
    tray::set_status(&app, &text.chars().take(80).collect::<String>());
}

/// Ouvre une adresse web dans le navigateur par défaut (http/https uniquement).
#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Adresse invalide.")?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("Adresse refusée.".into());
    }
    app.opener().open_url(parsed.as_str(), None::<&str>).map_err(|_| "Impossible d'ouvrir le navigateur.".to_string())
}

fn error_message(res: &ApiResponse, fallback: &str) -> String {
    res.body["message"].as_str().map(str::to_string).unwrap_or_else(|| match res.status {
        429 => "Trop de tentatives, réessayez plus tard.".into(),
        503 => "Le service Waverti n'est pas encore configuré sur ce serveur.".into(),
        _ => fallback.into(),
    })
}

#[derive(Serialize)]
pub struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    #[cfg(feature = "updater")]
    {
        use tauri_plugin_updater::UpdaterExt;
        let update = app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|_| "Impossible de vérifier les mises à jour.".to_string())?;
        Ok(update.map(|u| UpdateInfo { version: u.version, notes: u.body }))
    }
    #[cfg(not(feature = "updater"))]
    {
        let _ = app;
        Err("Les mises à jour automatiques ne sont pas activées dans cette version.".into())
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    #[cfg(feature = "updater")]
    {
        use tauri_plugin_updater::UpdaterExt;
        let update = app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|_| "Impossible de vérifier les mises à jour.".to_string())?
            .ok_or("Aucune mise à jour disponible.")?;
        // La signature du paquet est vérifiée par le module de mise à jour avant installation.
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|_| "Échec de l'installation de la mise à jour.".to_string())?;
        app.restart();
    }
    #[cfg(not(feature = "updater"))]
    {
        let _ = app;
        Err("Les mises à jour automatiques ne sont pas activées dans cette version.".into())
    }
}
