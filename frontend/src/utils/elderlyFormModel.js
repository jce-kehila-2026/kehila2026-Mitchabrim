const exactDigitsMessage = (label, length) => `${label} חייב להכיל ${length} ספרות בדיוק`;

export const normalizeLocationName = (value) => String(value ?? "")
  .normalize("NFKC")
  .trim()
  .replace(/\s+/g, " ");

export const locationNameKey = (value) => normalizeLocationName(value).toLocaleLowerCase("he");

export const digitsInput = (value, maxLength) => String(value ?? "")
  .replace(/\D/g, "")
  .slice(0, maxLength);

export function validateElderlyNumbers({ idNum = "", mobile = "", homePhone = "" } = {}) {
  const errors = {};
  const validate = (key, value, length, label, required = false) => {
    const text = String(value ?? "");
    if (!text) {
      if (required) errors[key] = "שדה חובה";
      return;
    }
    if (!/^\d+$/.test(text)) errors[key] = "יש להזין ספרות בלבד";
    else if (text.length !== length) errors[key] = exactDigitsMessage(label, length);
  };
  validate("idNum", idNum, 9, "מספר תעודת זהות");
  validate("mobile", mobile, 10, "מספר טלפון נייד", true);
  validate("homePhone", homePhone, 9, "מספר טלפון בית");
  return errors;
}

export function validateBirthDate(value, today = new Date()) {
  const text = String(value ?? "");
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "יש להזין תאריך לידה מלא ותקין";
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return "תאריך הלידה אינו תקין";
  const todayOnly = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (parsed.getTime() > todayOnly) return "תאריך לידה לא יכול להיות בעתיד";
  return "";
}

export function normalizeLanguages(record = {}) {
  const source = Array.isArray(record.languages)
    ? record.languages
    : String(record.language || "").split(",");
  return [...new Map(source
    .map(normalizeLocationName)
    .filter(Boolean)
    .map((language) => [locationNameKey(language), language])).values()];
}

export function sortElderlyRecords(records = [], mode = "", recentlyViewedIds = []) {
  const name = (record) => `${record?.firstName || ""} ${record?.lastName || ""}`.trim();
  const compareName = (left, right) => name(left).localeCompare(name(right), "he");
  const recentOrder = new Map(recentlyViewedIds.map((id, index) => [String(id), index]));
  return [...records].sort((left, right) => {
    if (mode === "alphabetical" || mode === "לפי האלף-בית") return compareName(left, right);
    if (mode === "neighborhood" || mode === "לפי שכונות") {
      const neighborhoodOrder = String(left?.neighborhood || "ZZZZ").localeCompare(
        String(right?.neighborhood || "ZZZZ"),
        "he",
      );
      return neighborhoodOrder || compareName(left, right);
    }
    if (mode === "lastContact" || mode === "לפי קשר אחרון") {
      const leftDate = String(left?.lastContact || "");
      const rightDate = String(right?.lastContact || "");
      if (!leftDate && !rightDate) return compareName(left, right);
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return rightDate.localeCompare(leftDate) || compareName(left, right);
    }
    if (mode === "recentViews" || mode === "צפיות אחרונות") {
      const leftRank = recentOrder.get(String(left?.id));
      const rightRank = recentOrder.get(String(right?.id));
      if (leftRank == null && rightRank == null) return compareName(left, right);
      if (leftRank == null) return 1;
      if (rightRank == null) return -1;
      return leftRank - rightRank;
    }
    return 0;
  });
}

export function updateAreasModel(areas = [], change = {}) {
  const oldArea = normalizeLocationName(change.oldArea);
  const newArea = normalizeLocationName(change.newArea);
  const oldNeighborhood = normalizeLocationName(change.oldNeighborhood);
  const newNeighborhood = normalizeLocationName(change.newNeighborhood);
  const targetArea = normalizeLocationName(change.targetArea);
  const next = (areas || []).map((area) => ({
    area: normalizeLocationName(area.area),
    neighborhoods: (area.neighborhoods || []).map(normalizeLocationName).filter(Boolean),
  }));
  const hasArea = (name, ignore = "") => next.some((area) => (
    locationNameKey(area.area) === locationNameKey(name)
    && locationNameKey(area.area) !== locationNameKey(ignore)
  ));
  const allNeighborhoods = (ignore = "") => next.flatMap((area) => area.neighborhoods)
    .filter((name) => locationNameKey(name) !== locationNameKey(ignore));

  if (change.type === "renameArea") {
    if (!newArea || hasArea(newArea, oldArea)) throw new Error("שם אזור ריק או קיים");
    const found = next.find((area) => locationNameKey(area.area) === locationNameKey(oldArea));
    if (!found) throw new Error("האזור לא נמצא");
    found.area = newArea;
  } else if (change.type === "renameNeighborhood") {
    if (!newNeighborhood || allNeighborhoods(oldNeighborhood).some(
      (name) => locationNameKey(name) === locationNameKey(newNeighborhood),
    )) throw new Error("שם שכונה ריק או קיים");
    const foundArea = next.find((area) => locationNameKey(area.area) === locationNameKey(oldArea));
    const index = foundArea?.neighborhoods.findIndex(
      (name) => locationNameKey(name) === locationNameKey(oldNeighborhood),
    ) ?? -1;
    if (index < 0) throw new Error("השכונה לא נמצאה");
    foundArea.neighborhoods[index] = newNeighborhood;
  } else if (change.type === "moveNeighborhood") {
    const source = next.find((area) => locationNameKey(area.area) === locationNameKey(oldArea));
    const target = next.find((area) => locationNameKey(area.area) === locationNameKey(targetArea));
    const index = source?.neighborhoods.findIndex(
      (name) => locationNameKey(name) === locationNameKey(oldNeighborhood),
    ) ?? -1;
    if (index < 0 || !target || source === target) throw new Error("העברת שכונה אינה תקינה");
    if (target.neighborhoods.some((name) => locationNameKey(name) === locationNameKey(oldNeighborhood))) {
      throw new Error("השכונה כבר קיימת באזור היעד");
    }
    source.neighborhoods.splice(index, 1);
    target.neighborhoods.push(oldNeighborhood);
  } else {
    throw new Error("פעולת מיקום לא מוכרת");
  }
  return next
    .sort((a, b) => a.area.localeCompare(b.area, "he"))
    .map((area) => ({
      ...area,
      neighborhoods: [...area.neighborhoods].sort((a, b) => a.localeCompare(b, "he")),
    }));
}
