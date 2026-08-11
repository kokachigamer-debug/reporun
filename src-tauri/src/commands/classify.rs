//! CLI argument detection (Phases 3.6 / 3.9). Walks all `.py` / `.js` / `.ts` /
//! `.mjs` files and regex-matches argparse, click, commander, and yargs patterns.

use std::fs;
use std::path::Path;

use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedArg {
    pub name: String,
    pub help: Option<String>,
    pub required: bool,
    pub source: String,
}

pub fn find_cli_args(folder_path: &str) -> Result<Vec<DetectedArg>, String> {
    let root = Path::new(folder_path);
    if !root.exists() {
        return Err(format!("folder not found: {folder_path}"));
    }

    // Order matters: dedupe by (name) keeping first occurrence.
    let mut out: Vec<DetectedArg> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Python argparse: add_argument("--foo", ...)
    let re_argparse = Regex::new(
        r#"add_argument\(\s*['"](--?[A-Za-z0-9_\-]+)['"](?:\s*,\s*['"](-?--?[A-Za-z0-9_\-]+)['"])?(?:(?:.*?)help\s*=\s*['"]([^'"]*)['"])??"#,
    )
    .map_err(|e| e.to_string())?;
    // Click: @click.option("--foo", ...)
    let re_click = Regex::new(
        r#"(?:@\s*click\.option|@\s*app\.command\(.*?option|option)\(\s*['"](--?[A-Za-z0-9_\-]+)['"]"#,
    )
    .map_err(|e| e.to_string())?;
    // Commander: .option("-f, --foo <bar>", "desc")
    let re_commander = Regex::new(
        r#"\.option\(\s*['"](?:-[A-Za-z0-9],\s*)?--([A-Za-z0-9_\-]+)(?:\s+[<\[][^)\]]+[>\]])?['"](?:\s*,\s*['"]([^'"]*)['"])?"#,
    )
    .map_err(|e| e.to_string())?;
    // Yargs: .option("foo", { describe: "..." })
    let re_yargs = Regex::new(
        r#"\.option\(\s*['"]([A-Za-z0-9_\-]+)['"]\s*,\s*\{[^}]*?describe:\s*['"]([^'"]*)['"]"#,
    )
    .map_err(|e| e.to_string())?;

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let rel = path
            .strip_prefix(root)
            .ok()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let lower = rel.to_lowercase();
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let matches: Vec<(Regex, &str)> = vec![
            (re_argparse.clone(), "python"),
            (re_click.clone(), "click"),
            (re_commander.clone(), "commander"),
            (re_yargs.clone(), "yargs"),
        ];

        for (re, source) in matches {
            // Only scan relevant file types per source to avoid noise.
            let scan = match source {
                "python" | "click" => lower.ends_with(".py"),
                "commander" | "yargs" => {
                    lower.ends_with(".js") || lower.ends_with(".ts") || lower.ends_with(".mjs")
                }
                _ => false,
            };
            if !scan {
                continue;
            }
            for caps in re.captures_iter(&content) {
                // For argparse/click/commander the first capture group is the arg
                // name (commander strips leading --). Normalize to bare name.
                let raw = caps
                    .get(1)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
                if raw.is_empty() {
                    continue;
                }
                let name = raw
                    .trim_start_matches("--")
                    .trim_start_matches('-')
                    .to_string();
                if name.is_empty() || seen.contains(&name) {
                    continue;
                }
                seen.insert(name.clone());
                let help = caps
                    .get(3)
                    .or_else(|| caps.get(2))
                    .map(|m| m.as_str().to_string());
                out.push(DetectedArg {
                    name,
                    help,
                    required: false,
                    source: source.to_string(),
                });
            }
        }
    }
    Ok(out)
}
