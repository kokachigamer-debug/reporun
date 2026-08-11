//! Runtime + container detection (Phases 3.11 / Section 7).
//!
//! Detects and reports (never silently assumes) the presence + version of
//! Python, Node, Docker, Podman. Container bundling (Podman) is a documented
//! stub here — the silent install is OS-specific and deferred to platform code.

use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RuntimeKind {
    Docker,
    Podman,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeVersions {
    pub python: Option<String>,
    pub node: Option<String>,
    pub docker: Option<String>,
    pub podman: Option<String>,
}

pub fn detect_runtimes() -> RuntimeVersions {
    RuntimeVersions {
        python: version_of("python", &["--version"]),
        node: version_of("node", &["--version"]),
        docker: version_of("docker", &["--version"]),
        podman: version_of("podman", &["--version"]),
    }
}

fn version_of(bin: &str, args: &[&str]) -> Option<String> {
    let out = Command::new(bin).args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let s = if s.is_empty() {
        String::from_utf8_lossy(&out.stderr).trim().to_string()
    } else {
        s
    };
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// Returns the first working container runtime. If both absent, the caller must
/// trigger the silent Podman-bundling flow (Section 3.11).
pub fn detect_container_runtime() -> Option<RuntimeKind> {
    if version_of("docker", &["--version"]).is_some() {
        // Confirm docker actually responds (not just installed-but-broken).
        if let Ok(out) = Command::new("docker")
            .args(["info", "--format", "{{.ServerVersion}}"])
            .output()
        {
            if out.status.success() {
                return Some(RuntimeKind::Docker);
            }
        }
    }
    if version_of("podman", &["--version"]).is_some() {
        return Some(RuntimeKind::Podman);
    }
    None
}

/// Disk space check before extraction (Section 6.3).
pub fn available_disk_bytes(path: &str) -> Result<u64, String> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let target = std::path::Path::new(path);
    let mut best: Option<u64> = None;
    for d in disks.list() {
        let mount = d.mount_point();
        if target.starts_with(mount) {
            best = Some(d.available_space());
        }
    }
    best.ok_or_else(|| format!("no mount found for {path}"))
}

/// Hardware capability check surfaced on first run (Section 23 — honest "here's
/// what your machine can run").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareClass {
    pub cpu_count: usize,
    pub total_memory_gb: f64,
    pub has_gpu_signal: bool,
}

pub fn hardware_class() -> HardwareClass {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();
    let total_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let has_gpu_signal = detect_gpu_signal();
    HardwareClass {
        cpu_count: sys.cpus().len(),
        total_memory_gb: (total_gb * 10.0).round() / 10.0,
        has_gpu_signal,
    }
}

fn detect_gpu_signal() -> bool {
    // Heuristic: look for nvidia-smi or a CUDA env var. Honest "signal", not a
    // guarantee — surfaced as such in the first-run check.
    if std::env::var_os("CUDA_PATH").is_some() {
        return true;
    }
    Command::new("nvidia-smi")
        .arg("--query-gpu=name")
        .arg("--format=csv,noheader")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
