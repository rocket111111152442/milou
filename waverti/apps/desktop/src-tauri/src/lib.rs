mod api;
mod commands;
mod error;
mod ip_policy;
mod safe_fetch;
mod state;
mod store;
mod tray;
mod url_policy;

use std::time::Duration;

use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

use state::AppState;

/// Argument ajouté au lancement automatique : la fenêtre reste fermée, l'icône est visible.
const HIDDEN_ARG: &str = "--hidden";
/// Cadence à laquelle l'interface est réveillée pour faire avancer l'agent (même fenêtre masquée).
const TICK: Duration = Duration::from_secs(20);

/// Crée la fenêtre principale à partir de tauri.conf.json (`create: false`).
///
/// Compilation de développement sous Windows uniquement : WebView2 ignore la variable
/// `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` lorsque l'application fixe ses propres arguments (ce que fait
/// wry). Les tests WebDriver (msedgedriver) ont besoin du port de débogage qu'ils transmettent par cette
/// variable : elle est donc relayée ici, avec le dossier de données qu'ils imposent. Jamais en version publiée.
fn create_main_window(app: &tauri::App) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .expect("fenêtre « main » absente de tauri.conf.json");
    #[allow(unused_mut)]
    let mut builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
    if cfg!(all(windows, debug_assertions)) {
        if let Ok(extra) = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
            builder = builder.additional_browser_args(&format!(
                "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection {extra}"
            ));
        }
        if let Ok(dir) = std::env::var("WEBVIEW2_USER_DATA_FOLDER") {
            builder = builder.data_directory(dir.into());
        }
    }
    builder.build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        // Doit être enregistré en premier : une seconde instance réaffiche simplement la première.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_ARG])));

    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder = builder
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let config_dir = app.path().app_config_dir()?;
            app.manage(AppState::new(data_dir, config_dir));
            create_main_window(app)?;
            tray::create(app.handle())?;

            if !std::env::args().any(|a| a == HIDDEN_ARG) {
                tray::show_main(app.handle());
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(TICK);
                loop {
                    interval.tick().await;
                    let _ = handle.emit("agent://tick", ());
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Fermer la fenêtre ne quitte pas Waverti : l'icône reste visible et le dit.
                api.prevent_close();
                let _ = window.hide();
                let app = window.app_handle();
                let state = app.state::<AppState>();
                let shown = state.settings.lock().unwrap().close_hint_shown;
                if !shown {
                    state.update_settings(|s| s.close_hint_shown = true);
                    let _ = app
                        .notification()
                        .builder()
                        .title("Waverti reste actif")
                        .body("Les contrôles continuent depuis la zone de notification. Pour quitter : clic droit sur l'icône Waverti, puis « Quitter ».")
                        .show();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::link_start,
            commands::link_poll,
            commands::link_cancel,
            commands::unlink,
            commands::api_request,
            commands::fetch_page,
            commands::fetch_robots,
            commands::set_paused,
            commands::report_status,
            commands::open_external,
            commands::check_update,
            commands::install_update,
        ]);

    builder.run(tauri::generate_context!()).expect("erreur au lancement de Waverti");
}
