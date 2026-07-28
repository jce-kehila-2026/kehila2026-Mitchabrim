const TRANSIENT_CODES = new Set([
  "aborted",
  "cancelled",
  "deadline-exceeded",
  "internal",
  "network-request-failed",
  "resource-exhausted",
  "storage/retry-limit-exceeded",
  "storage/unknown",
  "unavailable",
  "unknown",
]);

const PERMISSION_CODES = new Set([
  "permission-denied",
  "storage/unauthorized",
  "auth/operation-not-allowed",
  "unauthenticated",
]);

const INVALID_CODES = new Set([
  "already-exists",
  "auth/invalid-email",
  "auth/wrong-password",
  "failed-precondition",
  "invalid-argument",
  "not-found",
  "storage/invalid-argument",
]);

export function normalizeErrorCode(error) {
  return String(error?.code || "")
    .replace(/^firestore\//, "")
    .replace(/^functions\//, "")
    .toLowerCase();
}

export function classifyError(error) {
  const code = normalizeErrorCode(error);
  if (PERMISSION_CODES.has(code)) return "permission";
  if (INVALID_CODES.has(code)) return "invalid";
  if (TRANSIENT_CODES.has(code) || error?.name === "TimeoutError") return "transient";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return "unknown";
}

export function isTransientError(error) {
  return ["transient", "offline"].includes(classifyError(error));
}

export function userErrorMessage(error) {
  switch (classifyError(error)) {
    case "permission": return "אין הרשאה לביצוע הפעולה. יש להתחבר מחדש או לפנות למנהל.";
    case "invalid": return "הנתונים אינם תקינים או שהפריט אינו קיים עוד.";
    case "offline": return "אין חיבור לרשת. הפעולה לא נשלחה; יש להתחבר ולנסות שוב.";
    case "transient": return "השירות אינו זמין זמנית. אפשר לנסות שוב בעוד רגע.";
    default: return "אירעה שגיאה בלתי צפויה. אפשר לנסות שוב או לרענן את הדף.";
  }
}

export function withTimeout(promiseOrFactory, {
  timeoutMs = 15000,
  label = "operation",
} = {}) {
  let timer;
  const operation = typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.name = "TimeoutError";
      error.code = "deadline-exceeded";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

export async function retrySafeRead(worker, {
  retries = 2,
  baseDelayMs = 200,
  timeoutMs = 15000,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await withTimeout(() => worker(attempt), { timeoutMs, label: "read" });
    } catch (error) {
      if (attempt >= retries || !isTransientError(error)) throw error;
      await delay(baseDelayMs * (2 ** attempt));
      attempt += 1;
    }
  }
}
