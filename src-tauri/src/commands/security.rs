//! Pre-flight security scan (Section 22 #1). Scans for secret patterns and
//! known-bad/suspicious patterns before any setup begins, alongside classification.

use std::fs;
use std::path::Path;

use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityFinding {
    pub kind: String, // "secret" | "malware" | "suspicious"
    pub file: String,
    pub pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScanResult {
    pub ok: bool,
    pub findings: Vec<SecurityFinding>,
}

const MAX_SCAN_BYTES: usize = 2_000_000;

// Patterns are intentionally broad + inert (test fixtures in tests/security/).
// These are *signals* for the pre-flight warning, not verdicts.
fn secret_patterns() -> Vec<(&'static str, Regex)> {
    vec![
        ("AWS access key", Regex::new(r"AKIA[0-9A-Z]{16}").unwrap()),
        ("GitHub PAT", Regex::new(r"ghp_[0-9A-Za-z]{36}").unwrap()),
        (
            "Generic API key",
            Regex::new("(?i)[A-Z0-9_]*API_KEY[A-Z0-9_]*\\s*[:=]\\s*['\"][A-Za-z0-9_\\-]{20,}['\"]")
                .unwrap(),
        ),
        (
            "Private key block",
            Regex::new(r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----").unwrap(),
        ),
        (
            "Slack token",
            Regex::new(r"xox[baprs]-[0-9A-Za-z-]{10,}").unwrap(),
        ),
    ]
}

fn malware_patterns() -> Vec<(&'static str, Regex)> {
    vec![
        (
            "reverse shell",
            Regex::new(r"(?i)bash\s+-i\s+>&\s*/dev/(tcp|udp)/").unwrap(),
        ),
        (
            "curl pipe sh",
            Regex::new(r"(?i)curl[^|]*\|\s*(sh|bash)").unwrap(),
        ),
        (
            "wget pipe sh",
            Regex::new(r"(?i)wget[^|]*\|\s*(sh|bash)").unwrap(),
        ),
        (
            "known obfuscation",
            Regex::new(r"(?i)eval\s*\(\s*base64_decode\s*\(").unwrap(),
        ),
        (
            "crypto miner download",
            Regex::new(r"(?i)(xmrig|stratum\+tcp://)").unwrap(),
        ),
    ]
}

pub fn scan_folder(folder_path: &str) -> Result<SecurityScanResult, String> {
    let root = Path::new(folder_path);
    if !root.exists() {
        return Err(format!("folder not found: {folder_path}"));
    }
    let secrets = secret_patterns();
    let malware = malware_patterns();
    let mut findings = Vec::new();

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let rel = path
            .strip_prefix(root)
            .ok()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        // Skip likely-binary / huge files.
        let content = match fs::read_to_string(path) {
            Ok(c) if c.len() <= MAX_SCAN_BYTES => c,
            _ => continue,
        };

        for (name, re) in &secrets {
            if re.is_match(&content) {
                findings.push(SecurityFinding {
                    kind: "secret".into(),
                    file: rel.clone(),
                    pattern: name.to_string(),
                });
            }
        }
        for (name, re) in &malware {
            if re.is_match(&content) {
                findings.push(SecurityFinding {
                    kind: "malware".into(),
                    file: rel.clone(),
                    pattern: name.to_string(),
                });
            }
        }
    }

    let ok = findings.is_empty();
    Ok(SecurityScanResult { ok, findings })
}
