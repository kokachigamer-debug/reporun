// Typed wrappers around Tauri invoke() for the Rust commands registered in
// src-tauri/src/lib.rs. Keeps the call sites typed and centralized.

import { invoke } from "@tauri-apps/api/core";
import type { RuntimeVersions, SecurityScanResult } from "@/types";

export type { RuntimeVersions, SecurityScanResult };

export interface ZipEntryInfo {
  name: string;
  uncompressedSize: number;
}

export interface DetectedArg {
  name: string;
  help: string | null;
  required: boolean;
  source: string;
}

export interface RunOutcome {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ContainerRunInfo {
  tag: string;
  containerId: string;
  hostPort: number;
  containerPort: number;
}

export interface HardwareClass {
  cpuCount: number;
  totalMemoryGb: number;
  hasGpuSignal: boolean;
}

export const listZipContents = (path: string) =>
  invoke<ZipEntryInfo[]>("list_zip_contents", { path });

export const extractZip = (path: string) =>
  invoke<string>("extract_zip", { path });

export const cleanupOldTemp = (olderThanSecs: number, keep: string[]) =>
  invoke<number>("cleanup_old_temp", { olderThanSecs, keep });

export const findCliArgs = (folderPath: string) =>
  invoke<DetectedArg[]>("find_cli_args", { folderPath });

export const scanContentSnippets = (folderPath: string) =>
  invoke<string[]>("scan_content_snippets", { folderPath });

export interface RunCliArgs {
  folderPath: string;
  entryFile: string;
  runtime: string;
  args: string[];
  env: Record<string, string>;
  timeoutSecs: number;
}
export const runCliTool = (a: RunCliArgs) =>
  invoke<RunOutcome>("run_cli_tool", {
    args: {
      folder_path: a.folderPath,
      entry_file: a.entryFile,
      runtime: a.runtime,
      args: a.args,
      env: a.env,
      timeout_secs: a.timeoutSecs,
    },
  });

export const detectRuntimes = () => invoke<RuntimeVersions>("detect_runtimes");

export const detectContainerRuntime = () =>
  invoke<string | null>("detect_container_runtime");

export const hardwareClass = () => invoke<HardwareClass>("hardware_class");

export const availableDiskBytes = (path: string) =>
  invoke<number>("available_disk_bytes", { path });

export const detectExposedPort = (folderPath: string) =>
  invoke<number>("detect_exposed_port", { folderPath });

export interface ContainerRunSpec {
  folderPath: string;
  tag: string;
  hostPort: number;
  containerPort: number;
  compose: boolean;
}
export const buildAndRun = (spec: ContainerRunSpec) =>
  invoke<ContainerRunInfo>("build_and_run", {
    spec: {
      folder_path: spec.folderPath,
      tag: spec.tag,
      host_port: spec.hostPort,
      container_port: spec.containerPort,
      compose: spec.compose,
    },
  });

export const composeUp = (folderPath: string) =>
  invoke<void>("compose_up", { folderPath });

export const pauseContainer = (containerId: string) =>
  invoke<void>("pause_container", { containerId });

export const stopContainer = (containerId: string) =>
  invoke<void>("stop_container", { containerId });

export const scanSecurity = (folderPath: string) =>
  invoke<SecurityScanResult>("scan_security", { folderPath });

export const exportDiagnostics = (logs: string[]) =>
  invoke<string>("export_diagnostics", { logs });
