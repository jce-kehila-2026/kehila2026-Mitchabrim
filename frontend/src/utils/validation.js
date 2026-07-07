/**
 * Shared input validators with Hebrew error messages.
 *
 * Used across public site, admin dashboard and volunteer area to enforce
 * consistent client-side validation BEFORE writing to Firestore.
 *
 * Pair with `src/utils/sanitize.js`: validators check the shape, sanitize
 * strips control chars / caps length. Both run on submit.
 */

// Hebrew + Arabic + English letters, spaces, hyphen, apostrophe, quote.
const NAME_RE = /^[\u0590-\u05FF\u0600-\u06FFa-zA-Z\s'"\-]+$/;
const DIGITS_RE = /^\d+$/;
// Pragmatic email regex (RFC 5322 simplified). Sufficient for UI validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const VAL_MSG = {
  required: "שדה חובה",
  lettersOnly: "יש להזין אותיות בלבד (עברית/אנגלית/ערבית)",
  emptyName: "לא ניתן להזין שם ריק או רווחים בלבד",
  digitsOnly: "יש להזין מספרים בלבד",
  phoneLength: "מספר טלפון חייב להכיל 9 או 10 ספרות",
  idLength: "מספר תעודת זהות חייב להכיל 9 ספרות בדיוק",
  emailInvalid: "כתובת אימייל אינה תקינה",
  dateInvalid: "תאריך לא תקין",
  numberInvalid: "ערך מספרי לא תקין",
  numberPositive: "יש להזין מספר חיובי",
  urlInvalid: "כתובת אתר אינה תקינה (יש לכלול http:// או https://)",
  fileTooLarge: "הקובץ גדול מדי",
  fileTypeInvalid: "סוג הקובץ אינו נתמך",
  fileMissing: "לא נבחר קובץ",
};

/** Strip all non-digit characters. */
export const digitsOnly = (v) => String(v ?? "").replace(/\D+/g, "");

/** Phone: 9 or 10 digits (Israeli mobile/landline). Ignores spaces/dashes. */
export function isValidPhone(v) {
  const d = digitsOnly(v);
  return d.length === 9 || d.length === 10;
}

/** Israeli ID: exactly 9 digits. */
export function isValidId(v) {
  const d = digitsOnly(v);
  return d.length === 9;
}

/** Name: letters only (Hebrew/Arabic/English), spaces allowed, non-empty after trim. */
export function isValidName(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return NAME_RE.test(s);
}

/** Email: basic format check after trim. */
export function isValidEmail(v) {
  const s = String(v ?? "").trim();
  return EMAIL_RE.test(s);
}

/** Generic positive integer / number. */
export function isValidNumber(v, { allowZero = true, allowFloat = true } = {}) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  if (Number.isNaN(n)) return false;
  if (!allowFloat && !Number.isInteger(n)) return false;
  if (!allowZero && n <= 0) return false;
  return true;
}

/** Valid date string parseable by Date (YYYY-MM-DD or similar). */
export function isValidDate(v) {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

/* ------------------------------------------------------------------ */
/* Field validators returning an error message or empty string         */
/* ------------------------------------------------------------------ */

export function validatePhone(v, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) return required ? VAL_MSG.required : "";
  if (!/^[\d\s\-+()]+$/.test(s)) return VAL_MSG.digitsOnly;
  if (!isValidPhone(s)) return VAL_MSG.phoneLength;
  return "";
}

export function validateId(v, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) return required ? VAL_MSG.required : "";
  if (!/^\d+$/.test(s)) return VAL_MSG.digitsOnly;
  if (!isValidId(s)) return VAL_MSG.idLength;
  return "";
}

export function validateName(v, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) return required ? VAL_MSG.emptyName : "";
  if (!NAME_RE.test(s)) return VAL_MSG.lettersOnly;
  return "";
}

export function validateEmail(v, { required = false } = {}) {
  const s = String(v ?? "").trim();
  if (!s) return required ? VAL_MSG.required : "";
  if (!EMAIL_RE.test(s)) return VAL_MSG.emailInvalid;
  return "";
}

export function validateNumber(v, { required = true, allowZero = true, allowFloat = true } = {}) {
  if (v === "" || v === null || v === undefined) return required ? VAL_MSG.required : "";
  if (!isValidNumber(v, { allowZero, allowFloat })) return VAL_MSG.numberInvalid;
  if (!allowZero && Number(v) <= 0) return VAL_MSG.numberPositive;
  return "";
}

export function validateDate(v, { required = true } = {}) {
  if (!v) return required ? VAL_MSG.required : "";
  if (!isValidDate(v)) return VAL_MSG.dateInvalid;
  return "";
}

/**
 * URL: must be http(s) or a plain domain (we auto-prepend https:// via normalizeUrl elsewhere).
 * Accepts both "example.com" and "https://example.com/path?x=1".
 */
export function isValidUrl(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    // Must have a hostname with at least one dot (e.g. example.com)
    return !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validateUrl(v, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) return required ? VAL_MSG.required : "";
  if (!isValidUrl(s)) return VAL_MSG.urlInvalid;
  return "";
}

/**
 * File validator. Returns an error message or empty string.
 * @param {File} file
 * @param {{ maxMB?: number, types?: string[] }} opts
 *   types: array of MIME type prefixes or exact matches (e.g. ["image/", "application/pdf"]).
 */
export function validateFile(file, { maxMB = 10, types = [] } = {}) {
  if (!file) return VAL_MSG.fileMissing;
  if (types.length > 0) {
    const t = String(file.type || "").toLowerCase();
    const ok = types.some((allowed) => {
      const a = String(allowed).toLowerCase();
      return a.endsWith("/") ? t.startsWith(a) : t === a;
    });
    if (!ok) return VAL_MSG.fileTypeInvalid;
  }
  if (typeof maxMB === "number" && maxMB > 0) {
    const maxBytes = maxMB * 1024 * 1024;
    if (file.size > maxBytes) return `${VAL_MSG.fileTooLarge} (מקסימום ${maxMB}MB)`;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* DOM input filters — wire to onInput / onChange to block characters  */
/* ------------------------------------------------------------------ */

/** Returns a sanitized digits-only string capped to maxLen. */
export function filterDigits(v, maxLen = 10) {
  return digitsOnly(v).slice(0, maxLen);
}

/** Returns a string with only allowed name characters. */
export function filterName(v, maxLen = 100) {
  const s = String(v ?? "").replace(/[^\u0590-\u05FF\u0600-\u06FFa-zA-Z\s'"\-]/g, "");
  return s.slice(0, maxLen);
}

export default {
  VAL_MSG,
  digitsOnly,
  isValidPhone,
  isValidId,
  isValidName,
  isValidEmail,
  isValidNumber,
  isValidDate,
  isValidUrl,
  validatePhone,
  validateId,
  validateName,
  validateEmail,
  validateNumber,
  validateDate,
  validateUrl,
  validateFile,
  filterDigits,
  filterName,
};
