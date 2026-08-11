//! Docker / Podman execution (Phases 3.10 / 3.11 / Section 5). Builds and runs
//! a single Dockerfile (Tier 2/3) or composes a multi-service stack (Tier 4).
//!
//! Host port is chosen dynamically (bind to :0 then read the bound port) rather
//! than a fixed 5000→5050 — required correctness fix (Section 3.10).

use std::process::Command;

use serde::{Deserialize, Serialize};

use super::sandbox::RuntimeKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerRunSpec {
    pub folder_path: String,
    pub tag: String,
    /// Host port hint; 0 = let the OS pick (recommended).
    pub host_port: u16,
    pub container_port: u16,
    pub compose: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerRunInfo {
    pub tag: String,
    pub container_id: String,
    pub host_port: u16,
    pub container_port: u16,
}

/// Scan the Dockerfile for the EXPOSE line so we don't hardcode port 5000.
/// Returns the first EXPOSE port found (Section 3.10).
pub fn detect_exposed_port(folder_path: &str) -> Result<u16, String> {
    let dockerfile = std::path::Path::new(folder_path).join("Dockerfile");
    let alt = std::path::Path::new(folder_path).join("dockerfile");
    let path = if dockerfile.exists() {
        dockerfile
    } else if alt.exists() {
        alt
    } else {
        return Err("no Dockerfile in folder".into());
    };
    let content = std::fs::read_to_string(&path).map_err(|e| format!("read Dockerfile: {e}"))?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed
            .to_ascii_lowercase()
            .strip_prefix("expose")
            .map(|rest| rest.trim().to_string())
            .is_some()
        {
            // "EXPOSE 5000" or "EXPOSE 5000/tcp"
            let rest = trimmed
                .split_once(' ')
                .map(|x| x.1)
                .unwrap_or("")
                .split('/')
                .next()
                .unwrap_or("");
            if let Ok(p) = rest.trim().parse::<u16>() {
                return Ok(p);
            }
        }
    }
    Err("no EXPOSE port found in Dockerfile".into())
}

fn runtime_binary(kind: &RuntimeKind) -> &'static str {
    match kind {
        RuntimeKind::Docker => "docker",
        RuntimeKind::Podman => "podman",
    }
}

/// Build the image, then `run -d -p <host>:<container> <tag>` and read back the
/// bound host port. Uses `-p 0:<container>` so the OS allocates a free host port.
pub fn build_and_run(
    spec: ContainerRunSpec,
    kind: &RuntimeKind,
) -> Result<ContainerRunInfo, String> {
    let bin = runtime_binary(kind);
    let build = Command::new(bin)
        .args(["build", "-t", &spec.tag, &spec.folder_path])
        .output()
        .map_err(|e| format!("spawn {bin} build: {e}"))?;
    if !build.status.success() {
        return Err(format!(
            "build failed: {}",
            String::from_utf8_lossy(&build.stderr)
        ));
    }

    let port_arg = format!("{}:{}", spec.host_port, spec.container_port);
    let run = Command::new(bin)
        .args(["run", "-d", "-p", &port_arg, &spec.tag])
        .output()
        .map_err(|e| format!("spawn {bin} run: {e}"))?;
    if !run.status.success() {
        return Err(format!(
            "run failed: {}",
            String::from_utf8_lossy(&run.stderr)
        ));
    }
    let container_id = String::from_utf8_lossy(&run.stdout).trim().to_string();

    // If host_port was 0, ask docker/podman for the bound port.
    let host_port = if spec.host_port == 0 {
        port_for_container(&container_id, kind)?
    } else {
        spec.host_port
    };

    Ok(ContainerRunInfo {
        tag: spec.tag,
        container_id,
        host_port,
        container_port: spec.container_port,
    })
}

fn port_for_container(container_id: &str, kind: &RuntimeKind) -> Result<u16, String> {
    let bin = runtime_binary(kind);
    let out = Command::new(bin)
        .args(["port", container_id])
        .output()
        .map_err(|e| format!("spawn {bin} port: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout);
    // e.g. "8080/tcp -> 0.0.0.0:32768"
    let port = text
        .lines()
        .find_map(|l| {
            l.split("->")
                .nth(1)
                .and_then(|s| s.rsplit(':').next())
                .and_then(|s| s.trim().parse::<u16>().ok())
        })
        .ok_or_else(|| format!("could not parse port mapping: {text}"))?;
    Ok(port)
}

/// Tier 4: `docker compose up -d` (or podman compose). Returns when stack is up.
pub fn compose_up(folder_path: &str, kind: &RuntimeKind) -> Result<(), String> {
    let bin = runtime_binary(kind);
    let args = vec!["compose".to_string(), "up".to_string(), "-d".to_string()];
    let out = Command::new(bin)
        .args(&args)
        .current_dir(folder_path)
        .output()
        .map_err(|e| format!("spawn {bin} compose: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "compose up failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(())
}

pub fn pause(container_id: &str, kind: &RuntimeKind) -> Result<(), String> {
    let bin = runtime_binary(kind);
    let out = Command::new(bin)
        .args(["pause", container_id])
        .output()
        .map_err(|e| format!("spawn {bin} pause: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}

pub fn stop(container_id: &str, kind: &RuntimeKind) -> Result<(), String> {
    let bin = runtime_binary(kind);
    let out = Command::new(bin)
        .args(["stop", container_id])
        .output()
        .map_err(|e| format!("spawn {bin} stop: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(())
}
