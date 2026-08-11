//! Zip reading + extraction (Phases 3.3 / 3.4).
//!
//! Extraction is path-traversal safe: no archive entry may escape the destination
//! directory. This is explicitly unit-tested in tests/zip_traversal.rs and is a
//! required security test (Section 24.4).

use std::fs::{self, File};
use std::io;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize)]
pub struct ZipEntryInfo {
    pub name: String,
    pub uncompressed_size: u64,
}

/// Phase 3.3 — list every entry name + uncompressed size (used for the disk
/// space check, Section 6.3).
pub fn list_zip_contents(path: &str) -> Result<Vec<ZipEntryInfo>, String> {
    let file = File::open(path).map_err(|e| format!("open zip: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("read zip: {e}"))?;
    let mut out = Vec::with_capacity(archive.len());
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("zip entry {i}: {e}"))?;
        out.push(ZipEntryInfo {
            name: entry.name().to_string(),
            uncompressed_size: entry.size(),
        });
    }
    Ok(out)
}

/// Phase 3.4 — extract every entry into a uniquely named temp folder. Returns
/// the extraction folder path.
///
/// The folder name embeds current-time-millis + a uuid to guarantee uniqueness
/// across concurrent/repeated extractions (Section 3.4).
pub fn extract_zip(path: &str) -> Result<String, String> {
    let dest = unique_temp_dir()?;
    let file = File::open(path).map_err(|e| format!("open zip: {e}"))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("read zip: {e}"))?;

    fs::create_dir_all(&dest).map_err(|e| format!("create dest: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("zip entry {i}: {e}"))?;
        // `enclosed_name` already strips parent traversal segments, but we
        // re-validate defensively below as well (defense in depth, Section 22).
        let rel = match entry.enclosed_name() {
            Some(p) => p.to_owned(),
            None => continue,
        };
        let outpath = sanitize_join(&dest, &rel)?;

        if entry.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| format!("mkdir: {e}"))?;
            continue;
        }
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir parent: {e}"))?;
        }
        let mut outfile = File::create(&outpath).map_err(|e| format!("create file: {e}"))?;
        io::copy(&mut entry, &mut outfile).map_err(|e| format!("copy file: {e}"))?;

        // Unix executable bit preservation.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
            }
        }
    }
    Ok(dest.to_string_lossy().to_string())
}

fn unique_temp_dir() -> Result<PathBuf, String> {
    let base = std::env::temp_dir();
    let stamp = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().simple().to_string();
    let dir = base.join(format!("reporun-{stamp}-{id}"));
    Ok(dir)
}

/// Join `base` with `rel` after confirming the resulting path stays inside
/// `base`. Rejects absolute paths and any `..` components — the canonical
/// path-traversal defense for zip extraction.
fn sanitize_join(base: &Path, rel: &Path) -> Result<PathBuf, String> {
    let mut out = base.to_path_buf();
    for comp in rel.components() {
        match comp {
            Component::Normal(s) => out.push(s),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("zip entry escapes destination: {}", rel.display()));
            }
        }
    }
    let canonical = out.canonicalize().unwrap_or_else(|_| out.clone());
    let base_canonical = base.canonicalize().unwrap_or_else(|_| base.to_path_buf());
    if !canonical.starts_with(&base_canonical) {
        return Err(format!("zip entry escapes destination: {}", rel.display()));
    }
    Ok(out)
}

/// Phase 6.2 cleanup — on app startup, delete any reporun-* temp folders older
/// than the Recent-list 24h window unless flagged as saved (caller decides).
pub fn cleanup_old_temp(older_than_secs: u64, keep: &[String]) -> Result<u32, String> {
    let base = std::env::temp_dir();
    let now = chrono::Utc::now().timestamp();
    let mut removed = 0u32;
    let entries = match fs::read_dir(&base) {
        Ok(e) => e,
        Err(_) => return Ok(0),
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("reporun-") {
            continue;
        }
        if keep.iter().any(|k| name == *k || entry.path() == *k) {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(mtime) = meta.modified() {
                let age = now
                    - mtime
                        .duration_since(std::time::UNIX_EPOCH)
                        .map_err(|e| format!("mtime: {e}"))?
                        .as_secs() as i64;
                if age as u64 >= older_than_secs {
                    let _ = fs::remove_dir_all(entry.path());
                    removed += 1;
                }
            }
        }
    }
    Ok(removed)
}
