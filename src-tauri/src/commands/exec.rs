//! Restricted execution (Phase 3.8) — current sandboxing baseline.
//!
//! NOT full sandbox isolation (Section 6.4 AppContainer is a tracked future item).
//! What this provides: working-dir confinement to the extracted repo, a stripped
//! environment with only the variables a package manager needs, a hard timeout,
//! and pre-use sanitization of every form value.

use std::process::{Command, Stdio};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use wait_timeout::ChildExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunRequest {
    pub folder_path: String,
    pub entry_file: String,
    pub runtime: String, // "python" | "node"
    pub args: Vec<String>,
    pub env: std::collections::BTreeMap<String, String>,
    pub timeout_secs: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunOutcome {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}

/// Strip leading/trailing quotes and trim whitespace (Section 3.8). Required —
/// Windows "Copy as path" wraps paths in literal quote characters.
fn sanitize_value(v: &str) -> String {
    v.trim().trim_matches(|c| c == '"' || c == '\'').to_string()
}

pub fn run_cli_tool(req: RunRequest) -> Result<RunOutcome, String> {
    let runtime = sanitize_value(&req.runtime);
    let entry = sanitize_value(&req.entry_file);

    let mut cmd = Command::new(&runtime);
    cmd.arg(&entry);
    for a in &req.args {
        cmd.arg(sanitize_value(a));
    }
    for (k, v) in &req.env {
        cmd.env(k, sanitize_value(v));
    }
    // Confine relative file access to the extracted repo (Section 6.1).
    cmd.current_dir(sanitize_value(&req.folder_path));

    // Strip full environment, then retain only what the runtime needs to find
    // installed packages (Section 3.8 — APPDATA/USERPROFILE required for pip).
    cmd.env_clear();
    let retained = retained_env_vars(&runtime);
    for var in retained {
        if let Ok(v) = std::env::var(var) {
            cmd.env(var, v);
        }
    }
    // User-supplied env wins over retained defaults.
    for (k, v) in &req.env {
        cmd.env(k, sanitize_value(v));
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("spawn {runtime}: {e}"))?;
    let timeout = Duration::from_secs(req.timeout_secs.max(1));

    match child
        .wait_timeout(timeout)
        .map_err(|e| format!("wait: {e}"))?
    {
        Some(status) => {
            let stdout = read_pipe(child.stdout.take());
            let stderr = read_pipe(child.stderr.take());
            Ok(RunOutcome {
                success: status.success(),
                exit_code: status.code(),
                stdout,
                stderr,
                timed_out: false,
            })
        }
        None => {
            // Exceeded budget — SIGKILL-equivalent.
            let _ = child.kill();
            let _ = child.wait();
            Ok(RunOutcome {
                success: false,
                exit_code: None,
                stdout: read_pipe(child.stdout.take()),
                stderr: format!("Script timed out after {} seconds", req.timeout_secs),
                timed_out: true,
            })
        }
    }
}

fn retained_env_vars(_runtime: &str) -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        &["PATH", "SYSTEMROOT", "APPDATA", "USERPROFILE"]
    } else {
        // macOS / Linux. PATH + HOME are required for package-manager lookup
        // (Section 3.8: verify empirically, don't assume Windows' list transfers).
        &["PATH", "HOME", "LANG", "LC_ALL"]
    }
}

fn read_pipe<R: std::io::Read>(pipe: Option<R>) -> String {
    let mut buf = Vec::new();
    if let Some(mut p) = pipe {
        let _ = p.read_to_end(&mut buf);
    }
    String::from_utf8_lossy(&buf).to_string()
}
