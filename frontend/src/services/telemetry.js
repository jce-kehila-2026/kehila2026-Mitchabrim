const SENSITIVE_KEY = /(email|phone|name|address|message|notes|token|secret|password|credential|authorization|uid|user|payload|data)/i;
const MAX_TEXT_LENGTH = 300;
const nativeConsole = typeof console !== "undefined"
  ? {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
  }
  : { error() {}, warn() {}, info() {} };

let installed = false;
const sessionId = globalThis.crypto?.randomUUID?.() || `session-${Date.now().toString(36)}`;
const endpoint = import.meta.env?.VITE_TELEMETRY_ENDPOINT || "";
const release = import.meta.env?.VITE_APP_RELEASE || "local";

function safeText(value) {
  return String(value ?? "")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\s().-]*){8,}\b/g, "[redacted-number]")
    .slice(0, MAX_TEXT_LENGTH);
}

export function redactTelemetryValue(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return safeText(value);
  if (value instanceof Error) {
    return {
      name: safeText(value.name),
      code: safeText(value.code || ""),
      message: safeText(value.message),
      stack: safeText(value.stack || ""),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => redactTelemetryValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : redactTelemetryValue(item, depth + 1),
    ]));
  }
  return safeText(value);
}

function eventPayload(level, event, context = {}) {
  return {
    level,
    event: safeText(event || "runtime_error"),
    at: new Date().toISOString(),
    release,
    sessionId,
    online: typeof navigator === "undefined" ? undefined : navigator.onLine,
    path: typeof location === "undefined" ? undefined : safeText(location.pathname),
    context: redactTelemetryValue(context),
  };
}

function transmit(payload) {
  if (!endpoint || typeof window === "undefined") return;
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Telemetry must never break the application or start a logging loop.
  }
}

export function captureError(error, context = {}) {
  const payload = eventPayload("error", context.event || "runtime_error", {
    ...context,
    error,
  });
  nativeConsole.error("[runtime]", JSON.stringify(payload));
  transmit(payload);
  return payload;
}

export function captureWarning(event, context = {}) {
  const payload = eventPayload("warn", event, context);
  if (import.meta.env?.DEV) nativeConsole.warn("[runtime]", JSON.stringify(payload));
  transmit(payload);
  return payload;
}

export function devLog(event, context = {}) {
  if (import.meta.env?.DEV) nativeConsole.info("[debug]", event, redactTelemetryValue(context));
}

export function installRuntimeMonitoring() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    captureError(event.error || new Error(event.message), { event: "window_error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    captureError(event.reason instanceof Error ? event.reason : new Error("Unhandled promise rejection"), {
      event: "unhandled_rejection",
    });
  });

  if (import.meta.env?.PROD && typeof console !== "undefined") {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
    console.warn = (...args) => captureWarning("legacy_console_warning", { arguments: args });
    console.error = (...args) => captureError(
      args.find((item) => item instanceof Error) || new Error("Legacy console error"),
      { event: "legacy_console_error", arguments: args },
    );
  }
}
