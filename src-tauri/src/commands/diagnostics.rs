//! Diagnostics export (Section 16). Privacy-safe bundle: app version, OS info,
//! hardware class, recent structured logs. NEVER repo contents, form values,
//! license/session tokens, or LLM API keys.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsBundle {
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub hardware: HardwareSnapshot,
    pub generated_at: String,
    pub recent_logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareSnapshot {
    pub cpu_count: usize,
    pub total_memory_gb: f64,
    pub has_gpu_signal: bool,
}

pub fn export_diagnostics(logs: Vec<String>) -> Result<String, String> {
    let bundle = DiagnosticsBundle {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hardware: HardwareSnapshot {
            cpu_count: num_cpus(),
            total_memory_gb: total_memory_gb(),
            has_gpu_signal: has_gpu_signal(),
        },
        generated_at: chrono::Utc::now().to_rfc3339(),
        recent_logs: logs,
    };
    let json = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    let dir = diagnostics_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("create diag dir: {e}"))?;
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%S");
    let path = dir.join(format!("reporun-diagnostics-{stamp}.json"));
    fs::write(&path, &json).map_err(|e| format!("write diag: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

fn diagnostics_dir() -> Result<PathBuf, String> {
    let base = std::env::var_os("REPORUN_DIAG_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let mut p = std::env::temp_dir();
            p.push("reporun-diagnostics");
            p
        });
    Ok(base)
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}

fn total_memory_gb() -> f64 {
    // Lazy sysinfo import avoided at top to keep this module self-contained.
    use sysinfo::System;
    let mut sys = System::new();
    sys.refresh_memory();
    let gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    (gb * 10.0).round() / 10.0
}

fn has_gpu_signal() -> bool {
    std::env::var_os("CUDA_PATH").is_some()
        || std::process::Command::new("nvidia-smi")
            .arg("--query-gpu=name")
            .arg("--format=csv,noheader")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
}
