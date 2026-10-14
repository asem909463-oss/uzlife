// API client: bearer auth with silent refresh, admin header, SSE streaming for Flash AI.
const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type Tokens = { access_token: string; refresh_token: string };
let tokens: Tokens | null = null;
let onTokens: (t: Tokens | null) => void = () => {};
let refreshing: Promise<boolean> | null = null;

export function setTokens(t: Tokens | null) {
  tokens = t;
}
export function onTokensChanged(cb: (t: Tokens | null) => void) {
  onTokens = cb;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!tokens?.refresh_token) return false;
  refreshing ??= (async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens?.refresh_token }),
      });
      if (!r.ok) throw new Error("refresh failed");
      const s = await r.json();
      tokens = { access_token: s.access_token, refresh_token: s.refresh_token };
      onTokens(tokens);
      return true;
    } catch {
      tokens = null;
      onTokens(null);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type Opts = { method?: string; body?: unknown; admin?: string | null };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, admin } = opts;
  const run = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : {}),
        ...(admin ? { "X-Admin-Token": admin } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  let res = await run();
  if (res.status === 401 && !admin && tokens?.refresh_token && (await tryRefresh())) res = await run();
  if (!res.ok) {
    let code = "error";
    try {
      const j = await res.json();
      if (typeof j.detail === "string") code = j.detail;
    } catch {}
    throw new ApiError(res.status, code);
  }
  return res.json();
}

export const photoUrl = (name?: string | null, w = 800) =>
  name ? `${BASE}/places/photo?name=${encodeURIComponent(name)}&w=${w}` : null;

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "action"; action: any; result: any }
  | { type: "action_error" }
  | { type: "done" }
  | { type: "error"; message?: string };

// XHR-based SSE reader (works on iOS, Android and web).
export function streamChat(body: unknown, onEvent: (e: StreamEvent) => void): () => void {
  const xhr = new XMLHttpRequest();
  let seen = 0;
  let buffer = "";
  let finished = false;
  const flush = () => {
    buffer += xhr.responseText.slice(seen);
    seen = xhr.responseText.length;
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim()) as StreamEvent;
        if (ev.type === "done" || ev.type === "error") finished = true;
        onEvent(ev);
      } catch {}
    }
  };
  xhr.open("POST", `${BASE}/ai/chat`);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (tokens?.access_token) xhr.setRequestHeader("Authorization", `Bearer ${tokens.access_token}`);
  xhr.onprogress = flush;
  xhr.onload = () => {
    if (xhr.status >= 400) {
      finished = true;
      onEvent({ type: "error", message: xhr.status === 403 ? "feature_disabled" : "http" });
      return;
    }
    flush();
    if (!finished) onEvent({ type: "done" });
  };
  xhr.onerror = () => {
    if (!finished) onEvent({ type: "error" });
  };
  xhr.send(JSON.stringify(body));
  return () => xhr.abort();
}
