import { createHmac, randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const TYPES = new Set(["אזרח ותיק", "פונה עבור אזרח ותיק אחר", "מתעניין בהתנדבות", "איש מקצוע", "אחר"]);
const IP_LIMIT = 10;
const PHONE_LIMIT = 3;
const IDEMPOTENCY_RETENTION_MS = 86_400_000;
const clean = (value, max) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const digest = (pepper, value) => createHmac("sha256", pepper).update(value).digest("hex");
const timestampMillis = (value) => (
  value && typeof value.toMillis === "function" ? value.toMillis() : null
);
const effectiveExpirationMillis = (document, retentionMs) => {
  const data = document?.data?.() || {};
  return timestampMillis(data.expiresAt)
    ?? (
      timestampMillis(data.createdAt) == null
        ? null
        : timestampMillis(data.createdAt) + retentionMs
    );
};

function validate(raw) {
  const data = {
    fullName: clean(raw?.fullName, 100), phone: clean(raw?.phone, 40),
    email: clean(raw?.email, 250), type: clean(raw?.type, 100),
    message: clean(raw?.message, 2000), idempotencyKey: clean(raw?.idempotencyKey, 128),
  };
  if (data.fullName.length < 2 || !/^\d{9,10}$/.test(data.phone) || !TYPES.has(data.type)) {
    throw new HttpsError("invalid-argument", "Invalid request details.");
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new HttpsError("invalid-argument", "Invalid request details.");
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(data.idempotencyKey)) {
    throw new HttpsError("invalid-argument", "Invalid request details.");
  }
  return data;
}

export async function submitJoinRequestCore({ db, data, ip, pepper, now = Date.now() }) {
  if (!pepper) throw new HttpsError("internal", "Service is not configured.");
  const input = validate(data);
  const idemHash = digest(pepper, input.idempotencyKey);
  const phoneHash = digest(pepper, input.phone);
  const duplicateHash = digest(pepper, `${input.phone}|${input.type}`);
  const ipHash = digest(pepper, ip || "unknown");
  const idemRef = db.collection("joinRequestIdempotency").doc(idemHash);
  const dupRef = db.collection("joinRequestDuplicates").doc(duplicateHash);
  const ipRef = db.collection("joinRequestRateLimits").doc(`ip_${ipHash}_${Math.floor(now / 600000)}`);
  const phoneRef = db.collection("joinRequestRateLimits").doc(`phone_${phoneHash}_${Math.floor(now / 86400000)}`);

  return db.runTransaction(async (tx) => {
    const [idem, duplicate, ipCounter, phoneCounter] = await Promise.all([
      tx.get(idemRef), tx.get(dupRef), tx.get(ipRef), tx.get(phoneRef),
    ]);
    if (
      idem.exists
      && effectiveExpirationMillis(idem, IDEMPOTENCY_RETENTION_MS) > now
    ) {
      return { status: "duplicate", requestId: idem.data().requestId };
    }
    if (
      duplicate.exists
      && effectiveExpirationMillis(duplicate, IDEMPOTENCY_RETENTION_MS) > now
    ) {
      return { status: "duplicate", requestId: duplicate.data().requestId };
    }
    if ((ipCounter.data()?.count || 0) >= IP_LIMIT || (phoneCounter.data()?.count || 0) >= PHONE_LIMIT) {
      throw new HttpsError("resource-exhausted", "Please try again later.");
    }
    const requestRef = db.collection("joinRequests").doc(randomUUID());
    const notificationRef = db.collection("notifications").doc(`join_${requestRef.id}`);
    const createdAt = FieldValue.serverTimestamp();
    tx.create(requestRef, {
      fullName: input.fullName, phone: input.phone, email: input.email, type: input.type,
      note: `${input.type} - ${input.message}`.trim(), status: "new", createdAt, submissionVersion: 1,
    });
    tx.create(notificationRef, {
      audience: "admin", type: "join_request", title: "בקשת הצטרפות חדשה התקבלה",
      message: `${input.fullName} שלח/ה בקשת הצטרפות (${input.type})`,
      requestId: requestRef.id, read: false, createdAt,
    });
    tx.set(idemRef, { requestId: requestRef.id, createdAt, expiresAt: Timestamp.fromMillis(now + IDEMPOTENCY_RETENTION_MS) });
    tx.set(dupRef, { requestId: requestRef.id, createdAt, expiresAt: Timestamp.fromMillis(now + IDEMPOTENCY_RETENTION_MS) });
    tx.set(ipRef, { count: FieldValue.increment(1), expiresAt: Timestamp.fromMillis(now + 1200000) }, { merge: true });
    tx.set(phoneRef, { count: FieldValue.increment(1), expiresAt: Timestamp.fromMillis(now + 172800000) }, { merge: true });
    return { status: "submitted", requestId: requestRef.id };
  });
}

export const limits = { IP_LIMIT, PHONE_LIMIT, IDEMPOTENCY_RETENTION_MS };
