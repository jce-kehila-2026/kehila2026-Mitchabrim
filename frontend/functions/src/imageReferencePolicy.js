import { HttpsError } from "firebase-functions/v2/https";

export const SITE_CONTENT_SECTIONS = new Set([
  "hero",
  "about",
  "activities",
  "quote",
  "gallery",
  "partners",
  "team",
  "press",
  "join",
  "footer",
]);

const staticFields = {
  hero: [
    ["imageMain", "דף הבית — Hero — תמונה ראשית"],
    ["imageTopLeft", "דף הבית — Hero — תמונה עליונה"],
    ["imageBottom", "דף הבית — Hero — תמונה תחתונה"],
  ],
  about: [["image", "דף הבית — About"]],
  quote: [["image", "דף הבית — ציטוט"]],
  press: [
    ["facebook.image", "דף הבית — כתבו עלינו — Facebook"],
    ["ynet.image", "דף הבית — כתבו עלינו — Ynet"],
  ],
};

const getAtPath = (value, path) => path.split(".").reduce(
  (current, part) => current?.[part],
  value,
);

const setAtPath = (value, path, nextValue) => {
  const parts = path.split(".");
  let current = value;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!current[parts[index]] || typeof current[parts[index]] !== "object") {
      current[parts[index]] = {};
    }
    current = current[parts[index]];
  }
  current[parts.at(-1)] = nextValue;
};

export function normalizeComparableImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    if (
      parsed.hostname === "firebasestorage.googleapis.com"
      || parsed.hostname.endsWith(".storage.googleapis.com")
    ) {
      parsed.search = "";
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function enumerateSectionImageFields(sectionKey, sectionData) {
  const fields = [];
  for (const [field, label] of staticFields[sectionKey] || []) {
    fields.push({ field, label, value: getAtPath(sectionData, field) });
  }

  if (sectionKey === "activities") {
    for (const [slug, detail] of Object.entries(sectionData?.details || {})) {
      fields.push({
        field: `details.${slug}.image`,
        label: `עמוד פעילות — ${detail?.title || slug}`,
        value: detail?.image,
      });
    }
  }

  if (sectionKey === "partners") {
    (sectionData?.items || []).forEach((item, index) => {
      const key = item?.imageUrl ? "imageUrl" : "logo";
      fields.push({
        field: `items.${index}.${key}`,
        label: `דף הבית — שותפים — ${item?.name || index + 1}`,
        value: item?.[key],
      });
    });
  }

  if (sectionKey === "team") {
    (sectionData?.members || []).forEach((member, index) => {
      fields.push({
        field: `members.${index}.img`,
        label: `דף הבית — צוות — ${member?.name || index + 1}`,
        value: member?.img,
      });
    });
  }

  return fields;
}

export function classifyAndCanonicalizeSection({
  sectionKey,
  sectionData,
  images,
  strict = true,
  preserveExistingReferences = false,
}) {
  const nextSection = structuredClone(sectionData || {});
  const byId = new Map(images.map((image) => [image.id, image]));
  const byUrl = new Map();
  images.forEach((image) => {
    const key = normalizeComparableImageUrl(image.url);
    if (!key) return;
    const matches = byUrl.get(key) || [];
    matches.push(image);
    byUrl.set(key, matches);
  });

  const references = [];
  const audit = {
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    external: 0,
    invalid: 0,
    alreadyReferenced: 0,
    issues: [],
  };
  const addIssue = (status, descriptor, value) => {
    if (audit.issues.length >= 100) return;
    audit.issues.push({
      status,
      section: sectionKey,
      field: descriptor.field,
      value: typeof value === "string" ? value : value?.imageId || "",
    });
  };

  for (const descriptor of enumerateSectionImageFields(sectionKey, nextSection)) {
    const value = descriptor.value;
    if (value == null || value === "") continue;

    let image = null;
    if (
      value
      && typeof value === "object"
      && !Array.isArray(value)
      && typeof value.imageId === "string"
    ) {
      image = byId.get(value.imageId.trim()) || null;
      if (!image) {
        audit.unmatched += 1;
        addIssue("unmatched", descriptor, value);
        continue;
      }
      audit.alreadyReferenced += 1;
    } else if (typeof value === "string") {
      const normalizedUrl = normalizeComparableImageUrl(value);
      const matches = byUrl.get(normalizedUrl) || [];
      if (matches.length > 1) {
        audit.ambiguous += 1;
        addIssue("ambiguous", descriptor, value);
        continue;
      }
      if (matches.length === 0) {
        if (/^https?:\/\//i.test(value) || value.startsWith("/")) {
          audit.external += 1;
          addIssue("external", descriptor, value);
        } else {
          audit.invalid += 1;
          addIssue("invalid", descriptor, value);
        }
        continue;
      }
      [image] = matches;
      audit.matched += 1;
    } else {
      audit.invalid += 1;
      addIssue("invalid", descriptor, value);
      continue;
    }

    if (image.status && image.status !== "active") {
      if (!strict) {
        audit.invalid += 1;
        addIssue("invalid", descriptor, value);
        continue;
      }
      throw new HttpsError("failed-precondition", "The selected image is not active.");
    }
    if (image.isPublic !== true || !image.url) {
      if (!strict) {
        audit.invalid += 1;
        addIssue("invalid", descriptor, value);
        continue;
      }
      throw new HttpsError(
        "failed-precondition",
        "A public site section cannot reference a private image.",
        { reason: "private-image-reference", imageId: image.id },
      );
    }
    if (image.mutationLock) {
      if (!strict) {
        audit.invalid += 1;
        addIssue("invalid", descriptor, value);
        continue;
      }
      throw new HttpsError(
        "aborted",
        "The selected image is currently being changed. Try again.",
        { reason: "image-mutation-in-progress", imageId: image.id },
      );
    }

    const canonical = {
      imageId: image.id,
      imageUrl: preserveExistingReferences && typeof value?.imageUrl === "string"
        ? value.imageUrl
        : image.url,
    };
    setAtPath(nextSection, descriptor.field, canonical);
    references.push({
      key: `home:${sectionKey}:${descriptor.field}`,
      section: sectionKey,
      documentId: "home",
      field: descriptor.field,
      label: descriptor.label,
    });
  }

  return { nextSection, references, audit };
}

export function usageRefsForImage(references, imageId, sectionData) {
  const values = new Map(
    enumerateSectionImageFields(references.sectionKey, sectionData)
      .filter(({ value }) => value?.imageId === imageId)
      .map(({ field, value }) => [field, value]),
  );
  return references.items.filter((reference) => values.has(reference.field));
}

export function assertActiveAdmin(userSnapshot) {
  const user = userSnapshot?.data?.() || userSnapshot?.data || null;
  const exists = typeof userSnapshot?.exists === "function"
    ? userSnapshot.exists()
    : userSnapshot?.exists;
  if (!exists) {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
  if (user?.role !== "admin" || user?.status !== "active") {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
}
