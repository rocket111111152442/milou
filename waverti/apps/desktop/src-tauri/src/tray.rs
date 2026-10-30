//! Icône permanente dans la zone de notification : l'activité de Waverti n'est jamais cachée.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::state::AppState;

pub struct TrayHandles {
    pub status: MenuItem<Wry>,
    pub toggle: MenuItem<Wry>,
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn toggle_label(paused: bool) -> &'static str {
    if paused {
        "Reprendre les contrôles sur cet ordinateur"
    } else {
        "Mettre en pause les contrôles sur cet ordinateur"
    }
}

pub fn set_paused(app: &AppHandle, paused: bool) {
    let state = app.state::<AppState>();
    state.update_settings(|s| s.paused = paused);
    if let Some(h) = app.try_state::<TrayHandles>() {
        let _ = h.toggle.set_text(toggle_label(paused));
    }
    let _ = app.emit("agent://paused", paused);
}

/// Texte d'état affiché dans le menu et l'infobulle, fourni par l'agent de l'interface.
pub fn set_status(app: &AppHandle, text: &str) {
    if let Some(h) = app.try_state::<TrayHandles>() {
        let _ = h.status.set_text(text);
    }
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(format!("Waverti — {text}")));
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let paused = app.state::<AppState>().is_paused();
    let open = MenuItem::with_id(app, "open", "Ouvrir Waverti", true, None::<&str>)?;
    let status = MenuItem::with_id(app, "status", "Démarrage…", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", toggle_label(paused), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter Waverti", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &PredefinedMenuItem::separator(app)?,
            &status,
            &toggle,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    app.manage(TrayHandles { status, toggle });

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Waverti")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "toggle" => {
                let paused = app.state::<AppState>().is_paused();
                set_paused(app, !paused);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
