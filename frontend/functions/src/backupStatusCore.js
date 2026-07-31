import { HttpsError } from "firebase-functions/v2/https";

const DATABASE_ID = "(default)";
const READY_STATE = "READY";
const PITR_ENABLED = "POINT_IN_TIME_RECOVERY_ENABLED";

const durationToDays = (duration) => {
  const match = /^([0-9]+)s$/.exec(String(duration || ""));
  if (!match) return null;
  return Math.round(Number(match[1]) / 86400);
};

const recurrenceOf = (schedule) => {
  if (schedule?.dailyRecurrence) return "daily";
  if (schedule?.weeklyRecurrence) return "weekly";
  return "unknown";
};

const newestFirst = (left, right) =>
  Date.parse(right?.snapshotTime || 0) - Date.parse(left?.snapshotTime || 0);

async function requireActiveAdmin(db, callerUid) {
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const caller = await db.collection("users").doc(callerUid).get();
  if (
    !caller.exists
    || caller.data()?.role !== "admin"
    || caller.data()?.status !== "active"
  ) {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
}

export async function backupStatusCore({
  db,
  callerUid,
  projectId,
  requestJson,
}) {
  await requireActiveAdmin(db, callerUid);
  if (!projectId || typeof requestJson !== "function") {
    throw new HttpsError("failed-precondition", "Backup status is not configured.");
  }

  const databaseName = `projects/${projectId}/databases/${DATABASE_ID}`;
  try {
    const [database, schedulesResponse, backupsResponse] = await Promise.all([
      requestJson(`/v1/${databaseName}`),
      requestJson(`/v1/${databaseName}/backupSchedules`),
      requestJson(`/v1/projects/${projectId}/locations/-/backups`),
    ]);

    const schedules = Array.isArray(schedulesResponse?.backupSchedules)
      ? schedulesResponse.backupSchedules
      : [];
    const schedule = schedules.find((item) => recurrenceOf(item) === "daily")
      || schedules[0]
      || null;
    const backups = (Array.isArray(backupsResponse?.backups)
      ? backupsResponse.backups
      : [])
      .filter((backup) => backup?.database === databaseName)
      .sort(newestFirst);
    const latest = backups[0] || null;

    return {
      available: true,
      enabled: Boolean(schedule),
      type: "firestore-managed-backups",
      location: database?.locationId || null,
      schedule: schedule ? recurrenceOf(schedule) : null,
      retentionDays: schedule ? durationToDays(schedule.retention) : null,
      latestBackup: latest
        ? {
          state: latest.state || "STATE_UNSPECIFIED",
          snapshotTime: latest.snapshotTime || null,
          expireTime: latest.expireTime || null,
        }
        : null,
      readyBackupsCount: backups.filter(
        (backup) => backup?.state === READY_STATE,
      ).length,
      pitrEnabled: database?.pointInTimeRecoveryEnablement === PITR_ENABLED,
      partial: Array.isArray(backupsResponse?.unreachable)
        && backupsResponse.unreachable.length > 0,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Firestore backup status read failed", {
      code: error?.code || null,
      status: error?.response?.status || null,
    });
    throw new HttpsError("unavailable", "Backup status is temporarily unavailable.");
  }
}
