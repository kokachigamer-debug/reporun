// Thin typed wrapper around Tauri `invoke`. In a non-Tauri unit-test environment
// invoke is replaced by a stub injected via the store, so callers don't need to
// mock the @tauri-apps/api module.

import { invoke as tauriInvoke } from "@tauri-apps/api/core";

let fallback: ((cmd: string, args?: Record<string, unknown>) => unknown) | null =
  null;

export function setInvokeFallback(
  fn: ((cmd: string, args?: Record<string, unknown>) => unknown) | null,
): void {
  fallback = fn;
}

export async function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (fallback) {
    return fallback(cmd, args) as T;
  }
  return tauriInvoke<T>(cmd, args);
}
