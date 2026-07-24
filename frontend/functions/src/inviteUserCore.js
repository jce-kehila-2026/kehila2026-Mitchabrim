import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const ROLES = new Set(["admin", "volunteer"]);
const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const cleanText = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

function validateInput(raw) {
  const input = {
    email: normalizeEmail(raw?.email),
    displayName: cleanText(raw?.displayName, 200),
    role: cleanText(raw?.role, 20),
    active: raw?.active !== false,
    linkedVolunteerId: cleanText(raw?.linkedVolunteerId, 200),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || !ROLES.has(input.role)) {
    throw new HttpsError("invalid-argument", "Invalid invitation details.");
  }
  if (input.role === "volunteer" && !input.linkedVolunteerId) {
    throw new HttpsError("invalid-argument", "Invalid invitation details.");
  }
  return input;
}

function isUserNotFound(error) {
  return error?.code === "auth/user-not-found";
}

export async function inviteUserCore({ db, auth, callerUid, data }) {
  if (!callerUid) throw new HttpsError("unauthenticated", "Authentication required.");
  const caller = await db.collection("users").doc(callerUid).get();
  if (!caller.exists || caller.data()?.role !== "admin" || caller.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }

  const input = validateInput(data);
  const duplicateEmail = await db.collection("users").where("email", "==", input.email).limit(1).get();
  if (!duplicateEmail.empty) throw new HttpsError("already-exists", "An invited account already exists.");

  let volunteerRef = null;
  if (input.role === "volunteer") {
    volunteerRef = db.collection("volunteers").doc(input.linkedVolunteerId);
    const [volunteer, duplicateLink] = await Promise.all([
      volunteerRef.get(),
      db.collection("users").where("linkedVolunteerId", "==", input.linkedVolunteerId).limit(1).get(),
    ]);
    if (!volunteer.exists || !duplicateLink.empty) {
      throw new HttpsError("failed-precondition", "The volunteer profile cannot be invited.");
    }
  }

  let authUser;
  let createdAuthUser = false;
  try {
    authUser = await auth.getUserByEmail(input.email);
    if (!authUser.emailVerified) {
      throw new HttpsError("failed-precondition", "The existing account requires administrator review.");
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (!isUserNotFound(error)) throw new HttpsError("internal", "Unable to create the invited account.");
    authUser = await auth.createUser({
      email: input.email,
      password: `${randomBytes(24).toString("base64url")}!Aa1`,
      displayName: input.displayName || undefined,
      emailVerified: false,
      disabled: false,
    });
    createdAuthUser = true;
  }

  const now = FieldValue.serverTimestamp();
  const userData = {
    email: input.email,
    fullName: input.displayName,
    displayName: input.displayName,
    role: input.role,
    status: input.active ? "active" : "inactive",
    active: input.active,
    updatedAt: now,
    createdAt: now,
    ...(input.role === "volunteer"
      ? { linkedVolunteerId: input.linkedVolunteerId }
      : { linkedVolunteerId: null }),
  };

  try {
    const batch = db.batch();
    batch.create(db.collection("users").doc(authUser.uid), userData);
    if (volunteerRef) {
      batch.update(volunteerRef, {
        authUid: authUser.uid,
        email: input.email,
        updatedAt: now,
      });
    }
    await batch.commit();
  } catch (error) {
    if (createdAuthUser) {
      try { await auth.deleteUser(authUser.uid); } catch {}
    }
    if (error?.code === 6 || error?.code === "already-exists") {
      throw new HttpsError("already-exists", "An invited account already exists.");
    }
    throw new HttpsError("internal", "Unable to complete the invitation.");
  }

  return { status: "created", createdAuthUser };
}
