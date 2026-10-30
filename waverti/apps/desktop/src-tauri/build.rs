fn main() {
    println!("cargo:rerun-if-env-changed=WAVERTI_API_URL");
    println!("cargo:rerun-if-env-changed=WAVERTI_ALLOW_INSECURE_API");
    // Une version publiée doit viser un serveur HTTPS explicitement choisi.
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        let url = std::env::var("WAVERTI_API_URL").unwrap_or_default();
        let insecure_ok = std::env::var("WAVERTI_ALLOW_INSECURE_API").as_deref() == Ok("1");
        if url.is_empty() || (!url.starts_with("https://") && !insecure_ok) {
            panic!("WAVERTI_API_URL (https://…) doit être défini pour une compilation en mode release.");
        }
    }
    tauri_build::build()
}
