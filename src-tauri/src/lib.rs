//! RepoRun Tauri backend — lib.rs registers commands only.
//! All logic lives in src/commands/*.rs (Section 2 rule).

pub mod commands;

use commands::classify::DetectedArg;
use commands::docker::{ContainerRunInfo, ContainerRunSpec};
use commands::exec::{RunOutcome, RunRequest};
use commands::sandbox::{HardwareClass, RuntimeKind, RuntimeVersions};
use commands::security::SecurityScanResult;
use commands::zip::ZipEntryInfo;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct RunArgs {
    folder_path: String,
    entry_file: String,
    runtime: String,
    args: Vec<String>,
    env: std::collections::BTreeMap<String, String>,
    timeout_secs: u64,
}

fn init_logging() {
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .try_init();
}

#[tauri::command]
fn list_zip_contents(path: String) -> Result<Vec<ZipEntryInfo>, String> {
    commands::zip::list_zip_contents(&path)
}

#[tauri::command]
fn extract_zip(path: String) -> Result<String, String> {
    commands::zip::extract_zip(&path)
}

#[tauri::command]
fn cleanup_old_temp(older_than_secs: u64, keep: Vec<String>) -> Result<u32, String> {
    commands::zip::cleanup_old_temp(older_than_secs, &keep)
}

#[tauri::command]
fn find_cli_args(folder_path: String) -> Result<Vec<DetectedArg>, String> {
    commands::classify::find_cli_args(&folder_path)
}

#[tauri::command]
fn scan_content_snippets(folder_path: String) -> Result<Vec<String>, String> {
    commands::agent::scan_content_snippets(&folder_path)
}

#[tauri::command]
fn run_cli_tool(args: RunArgs) -> Result<RunOutcome, String> {
    commands::exec::run_cli_tool(RunRequest {
        folder_path: args.folder_path,
        entry_file: args.entry_file,
        runtime: args.runtime,
        args: args.args,
        env: args.env,
        timeout_secs: args.timeout_secs,
    })
}

#[tauri::command]
fn detect_runtimes() -> RuntimeVersions {
    commands::sandbox::detect_runtimes()
}

#[tauri::command]
fn detect_container_runtime() -> Option<String> {
    commands::sandbox::detect_container_runtime().map(|k| match k {
        RuntimeKind::Docker => "docker".into(),
        RuntimeKind::Podman => "podman".into(),
    })
}

#[tauri::command]
fn hardware_class() -> HardwareClass {
    commands::sandbox::hardware_class()
}

#[tauri::command]
fn available_disk_bytes(path: String) -> Result<u64, String> {
    commands::sandbox::available_disk_bytes(&path)
}

#[tauri::command]
fn detect_exposed_port(folder_path: String) -> Result<u16, String> {
    commands::docker::detect_exposed_port(&folder_path)
}

#[tauri::command]
fn build_and_run(spec: ContainerRunSpec) -> Result<ContainerRunInfo, String> {
    let kind = commands::sandbox::detect_container_runtime().unwrap_or(RuntimeKind::Podman);
    commands::docker::build_and_run(spec, &kind)
}

#[tauri::command]
fn compose_up(folder_path: String) -> Result<(), String> {
    let kind = commands::sandbox::detect_container_runtime().unwrap_or(RuntimeKind::Podman);
    commands::docker::compose_up(&folder_path, &kind)
}

#[tauri::command]
fn pause_container(container_id: String) -> Result<(), String> {
    let kind = commands::sandbox::detect_container_runtime().unwrap_or(RuntimeKind::Podman);
    commands::docker::pause(&container_id, &kind)
}

#[tauri::command]
fn stop_container(container_id: String) -> Result<(), String> {
    let kind = commands::sandbox::detect_container_runtime().unwrap_or(RuntimeKind::Podman);
    commands::docker::stop(&container_id, &kind)
}

#[tauri::command]
fn scan_security(folder_path: String) -> Result<SecurityScanResult, String> {
    commands::security::scan_folder(&folder_path)
}

#[tauri::command]
fn export_diagnostics(logs: Vec<String>) -> Result<String, String> {
    commands::diagnostics::export_diagnostics(logs)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_zip_contents,
            extract_zip,
            cleanup_old_temp,
            find_cli_args,
            scan_content_snippets,
            run_cli_tool,
            detect_runtimes,
            detect_container_runtime,
            hardware_class,
            available_disk_bytes,
            detect_exposed_port,
            build_and_run,
            compose_up,
            pause_container,
            stop_container,
            scan_security,
            export_diagnostics,
        ])
        .setup(|app| {
            // First-run cleanup (Section 6.2): remove stale reporun-* temp dirs.
            let _ = commands::zip::cleanup_old_temp(24 * 60 * 60, &[]);
            // Touch hardware-class detection so the first-run check is fast.
            let _ = app.handle();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running RepoRun");
}

// Re-export for tests / potential reuse.
pub use commands::diagnostics::HardwareSnapshot as DiagnosticsHardware;
pub use commands::security::SecurityFinding as DiagnosticsFinding;
