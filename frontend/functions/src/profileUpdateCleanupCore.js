export async function profileUpdateCleanupCore({ db, requestId, data = {} }) {
  if (!requestId) throw new Error("requestId is required");

  const lockRef = data.volunteerAuthUid
    ? db.collection("profileUpdateRequestPending").doc(data.volunteerAuthUid)
    : null;
  const adminNotificationRef = db.collection("notifications").doc(
    `profile_request_${requestId}`,
  );
  const volunteerNotificationRef = db.collection("volunteerNotifications").doc(
    `profile_response_${requestId}`,
  );

  return db.runTransaction(async (transaction) => {
    const lockSnapshot = lockRef ? await transaction.get(lockRef) : null;
    if (
      lockSnapshot?.exists
      && lockSnapshot.data()?.requestId === requestId
    ) {
      transaction.delete(lockRef);
    }
    transaction.delete(adminNotificationRef);
    transaction.delete(volunteerNotificationRef);
    return {
      requestId,
      pendingLockDeleted: Boolean(
        lockSnapshot?.exists && lockSnapshot.data()?.requestId === requestId
      ),
    };
  });
}
