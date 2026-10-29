//! Conservation du jeton d'appareil. Priorité au trousseau du système (Windows Credential
//! Manager, Trousseau macOS, Secret Service sous Linux). Si aucun trousseau n'est disponible
//! (certaines sessions Linux), repli sur un fichier lisible par l'utilisateur seul — ce repli
//! est affiché dans les paramètres de l'application.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

const SERVICE: &str = "com.lullinweb.watchly";
const ACCOUNT: &str = "device-token";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Backend {
    Keyring,
    File,
}

pub struct TokenStore {
    file: PathBuf,
    use_keyring: bool,
}

impl TokenStore {
    pub fn new(data_dir: PathBuf) -> Self {
        Self { file: data_dir.join("device-token"), use_keyring: true }
    }

    #[cfg(test)]
    pub fn file_only(data_dir: PathBuf) -> Self {
        Self { file: data_dir.join("device-token"), use_keyring: false }
    }

    fn entry(&self) -> Option<keyring::Entry> {
        if !self.use_keyring {
            return None;
        }
        keyring::Entry::new(SERVICE, ACCOUNT).ok()
    }

    pub fn load(&self) -> Option<(String, Backend)> {
        if let Some(entry) = self.entry() {
            if let Ok(token) = entry.get_password() {
                return Some((token, Backend::Keyring));
            }
        }
        fs::read_to_string(&self.file)
            .ok()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .map(|t| (t, Backend::File))
    }

    pub fn save(&self, token: &str) -> std::io::Result<Backend> {
        if let Some(entry) = self.entry() {
            if entry.set_password(token).is_ok() && entry.get_password().ok().as_deref() == Some(token) {
                let _ = fs::remove_file(&self.file);
                return Ok(Backend::Keyring);
            }
        }
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir)?;
        }
        write_private(&self.file, token)?;
        Ok(Backend::File)
    }

    pub fn clear(&self) {
        if let Some(entry) = self.entry() {
            let _ = entry.delete_credential();
        }
        let _ = fs::remove_file(&self.file);
    }
}

#[cfg(unix)]
fn write_private(path: &PathBuf, content: &str) -> std::io::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let mut f = fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path)?;
    f.write_all(content.as_bytes())
}

#[cfg(not(unix))]
fn write_private(path: &PathBuf, content: &str) -> std::io::Result<()> {
    // Sous Windows, le dossier de données de l'application est déjà propre au profil utilisateur.
    fs::write(path, content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_fallback_roundtrip_and_permissions() {
        let dir = std::env::temp_dir().join(format!("watchly-store-{}", std::process::id()));
        let store = TokenStore::file_only(dir.clone());
        assert!(store.load().is_none());
        assert_eq!(store.save("wly_dev_abc").unwrap(), Backend::File);
        assert_eq!(store.load(), Some(("wly_dev_abc".into(), Backend::File)));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(dir.join("device-token")).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
        store.clear();
        assert!(store.load().is_none());
        let _ = fs::remove_dir_all(dir);
    }
}
