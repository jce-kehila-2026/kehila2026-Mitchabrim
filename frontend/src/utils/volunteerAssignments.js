export const ASSIGNED_VOLUNTEER_STATUS = "משויך לאזרח ותיק";
export const WAITING_VOLUNTEER_STATUS = "ממתין לשיבוץ";
export const ARCHIVED_VOLUNTEER_STATUS = "בארכיון";

export function deriveVolunteerAssignment(volunteer, elderly = []) {
  const assignedElderly = [...elderly].sort((a, b) => (
    String(a.name || "").localeCompare(String(b.name || ""), "he")
  ));
  const status = volunteer?.status === ARCHIVED_VOLUNTEER_STATUS
    ? ARCHIVED_VOLUNTEER_STATUS
    : assignedElderly.length > 0
      ? ASSIGNED_VOLUNTEER_STATUS
      : WAITING_VOLUNTEER_STATUS;

  return {
    ...volunteer,
    status,
    assignedElderly,
  };
}
