/**
 * Pont vers le processus Rust. L'interface ne détient jamais le jeton d'appareil : chaque appel
 * à l'API Waverti passe par `api_request`, qui n'accepte que des chemins `/api/`.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppInfo {
  version: string;
  platform: "windows" | "macos" | "linux";
  apiBase: string;
  linked: boolean;
  storage: "keyring" | "file" | null;
  paused: boolean;
  hostname: string;
  updaterAvailable: boolean;
  devAllowLocal: boolean;
}

export interface LinkStart {
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
  redirects: number;
  durationMs: number;
}

export interface NativeFetchError {
  code: string;
  message: string;
}

export function isNativeFetchError(e: unknown): e is NativeFetchError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

export const native = {
  appInfo: () => invoke<AppInfo>("app_info"),
  linkStart: (deviceName: string) => invoke<LinkStart>("link_start", { deviceName }),
  linkPoll: () => invoke<string>("link_poll"),
  linkCancel: () => invoke<void>("link_cancel"),
  unlink: () => invoke<void>("unlink"),
  apiRequest: (method: string, path: string, body?: unknown) =>
    invoke<{ status: number; body: unknown }>("api_request", { method, path, body: body ?? null }),
  fetchPage: (url: string) => invoke<FetchedPage>("fetch_page", { url }),
  fetchRobots: (url: string) => invoke<FetchedPage>("fetch_robots", { url }),
  setPaused: (paused: boolean) => invoke<void>("set_paused", { paused }),
  reportStatus: (text: string) => invoke<void>("report_status", { text }),
  openExternal: (url: string) => invoke<void>("open_external", { url }),
  checkUpdate: () => invoke<{ version: string; notes: string | null } | null>("check_update"),
  installUpdate: () => invoke<void>("install_update"),
};

export function onTick(cb: () => void): Promise<UnlistenFn> {
  return listen("agent://tick", () => cb());
}

export function onPaused(cb: (paused: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>("agent://paused", (e) => cb(e.payload));
}

export function onUnlinked(cb: () => void): Promise<UnlistenFn> {
  return listen("auth://unlinked", () => cb());
}
