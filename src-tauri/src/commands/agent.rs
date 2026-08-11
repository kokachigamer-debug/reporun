//! Lightweight content scan for agent-repo signal detection (Section 21).
//! Reads small text files (≤64KB each) so the frontend classify() can layer
//! agent signals on top of rule-based tier detection without a second pipeline.

use std::fs;
use std::path::Path;
use walkdir::WalkDir;

const MAX_FILES: usize = 200;
const MAX_FILE_BYTES: usize = 64_000;

pub fn scan_content_snippets(folder_path: &str) -> Result<Vec<String>, String> {
    let root = Path::new(folder_path);
    if !root.exists() {
        return Err(format!("folder not found: {folder_path}"));
    }
    let mut out = Vec::new();
    let mut count = 0;
    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if count >= MAX_FILES {
            break;
        }
        let path = entry.path();
        let lower = path.to_string_lossy().to_lowercase();
        let interesting = lower.ends_with(".py")
            || lower.ends_with(".js")
            || lower.ends_with(".ts")
            || lower.ends_with(".mjs")
            || lower.ends_with(".env.example")
            || lower.ends_with(".env.template")
            || lower.ends_with("dockerfile")
            || lower.ends_with("readme.md")
            || lower.ends_with("requirements.txt")
            || lower.ends_with("package.json");
        if !interesting {
            continue;
        }
        if let Ok(meta) = fs::metadata(path) {
            if meta.len() > MAX_FILE_BYTES as u64 {
                continue;
            }
        }
        if let Ok(content) = fs::read_to_string(path) {
            out.push(content);
            count += 1;
        }
    }
    Ok(out)
}
