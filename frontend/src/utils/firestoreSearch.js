const SEARCH_PREFIX_MIN_LENGTH = 2;
const HEBREW_FINAL_LETTERS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[ךםןףץ]/g, (letter) => HEBREW_FINAL_LETTERS[letter])
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSearchDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function addPrefixes(target, value, normalize = normalizeSearchText) {
  const normalized = normalize(value);
  for (let length = SEARCH_PREFIX_MIN_LENGTH; length <= normalized.length; length += 1) {
    target.add(normalized.slice(0, length));
  }
}

export function buildSearchPrefixes({ text = [], digits = [] } = {}) {
  const prefixes = new Set();
  text.filter(Boolean).forEach((value) => {
    const normalized = normalizeSearchText(value);
    addPrefixes(prefixes, normalized);
    normalized.split(" ").filter(Boolean).forEach((token) => addPrefixes(prefixes, token));
    if (normalized.includes(" ")) addPrefixes(prefixes, normalized.replace(/\s/g, ""));
  });
  digits.filter(Boolean).forEach((value) => addPrefixes(prefixes, value, normalizeSearchDigits));
  return Array.from(prefixes).slice(0, 500);
}

export function normalizeSearchTerm(value) {
  const text = normalizeSearchText(value);
  if (!text) return "";
  return /^[\d\s()+-]+$/.test(text) ? normalizeSearchDigits(text) : text;
}

export function getEffectiveSearchTerm(value, minLength = SEARCH_PREFIX_MIN_LENGTH) {
  const normalized = normalizeSearchTerm(value);
  return normalized.length >= minLength ? normalized : "";
}

export function buildElderlyQueryCriteria(criteria = {}) {
  return {
    status: "פעיל",
    area: criteria.area || "",
    neighborhood: criteria.neighborhood || "",
    marital: criteria.marital || "",
    volStatus: criteria.volStatus || "",
    searchTerm: getEffectiveSearchTerm(criteria.search),
  };
}

export function buildVolunteerQueryCriteria(criteria = {}) {
  return {
    area: criteria.area || "",
    neighborhood: criteria.neighborhood || "",
    status: criteria.status || "",
    insurance: criteria.insurance || "",
    searchTerm: getEffectiveSearchTerm(criteria.search),
  };
}

export function buildElderlySearchFields(data = {}) {
  const searchName = normalizeSearchText(`${data.firstName || ""} ${data.lastName || ""}`);
  const searchPhone = normalizeSearchDigits(data.mobile || data.homePhone);
  const searchIdNumber = normalizeSearchDigits(data.idNum);
  return {
    searchName,
    searchPhone,
    searchIdNumber,
    searchSchemaVersion: 1,
    searchPrefixes: buildSearchPrefixes({
      text: [searchName],
      digits: [data.mobile, data.homePhone, data.idNum],
    }),
  };
}

export function buildVolunteerSearchFields(data = {}) {
  const searchName = normalizeSearchText(data.name);
  const searchPhone = normalizeSearchDigits(data.phone);
  const searchIdNumber = normalizeSearchDigits(data.idNum);
  return {
    searchName,
    searchPhone,
    searchIdNumber,
    insuranceKey: data.insurance || "לא",
    searchSchemaVersion: 1,
    searchPrefixes: buildSearchPrefixes({
      text: [data.name, data.group, data.neighborhood, data.area],
      digits: [data.phone, data.idNum],
    }),
  };
}

export { SEARCH_PREFIX_MIN_LENGTH };
