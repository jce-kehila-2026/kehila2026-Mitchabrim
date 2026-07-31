/**
 * Shared input sanitization helpers (defense-in-depth against XSS / data corruption).
 *
 * React already escapes any value rendered as a child (e.g. {form.notes}), so
 * a literal "<script>alert(1)</script>" is shown as visible text and never
 * executed. We still sanitize at write-time so that:
 *   - control characters / NULL bytes / weird whitespace don't pollute the DB
 *   - if a value is ever sent to a non-React surface (CSV export, email,
 *     window.open URL, etc.) it stays inert
 *   - field lengths stay reasonable
 *
 * IMPORTANT: never wrap output of sanitizeText in dangerouslySetInnerHTML.
 * Always render through normal JSX / textContent.
 */

const DEFAULT_MAX_LENGTH = 5000;

/**
 * Sanitize a single text value. Returns a string (empty string for nullish).
 * - removes NULL bytes and control chars (keeps \n, \r, \t)
 * - normalizes CRLF
 * - trims surrounding whitespace
 * - caps length
 */
export function sanitizeText(value, maxLength = DEFAULT_MAX_LENGTH) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Strip control chars except newline / carriage return / tab
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  // Normalize newlines
  s = s.replace(/\r\n/g, "\n");
  // Trim
  s = s.trim();
  if (typeof maxLength === "number" && maxLength > 0 && s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

/**
 * Recursively sanitize all string values in a plain object / array.
 * Non-string values (numbers, booleans, Date, Firestore sentinels, refs,
 * nulls) are passed through untouched.
 */
export function sanitizeFormData(input, maxLength = DEFAULT_MAX_LENGTH) {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return sanitizeText(input, maxLength);
  if (Array.isArray(input)) return input.map((v) => sanitizeFormData(v, maxLength));
  if (typeof input === "object") {
    // Pass-through for non-plain objects (Date, Firestore Timestamp/sentinel, etc.)
    const proto = Object.getPrototypeOf(input);
    if (proto !== Object.prototype && proto !== null) return input;
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = sanitizeFormData(v, maxLength);
    }
    return out;
  }
  return input;
}

export default sanitizeText;
