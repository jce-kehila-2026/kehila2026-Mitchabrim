const participantKey = (participant) => String(
  participant?.elderlyId || participant?.id || "",
).trim();

export const hasSpecialNote = (participant) => (
  typeof participant?.notes === "string" && participant.notes.trim().length > 0
);

export const hasProjectAssignment = (participant) => Boolean(
  String(participant?.assignedGroupId || "").trim()
  || String(participant?.assignedVolunteerId || "").trim(),
);

export function uniqueProjectParticipants(participants = []) {
  const unique = new Map();
  participants.forEach((participant, index) => {
    const key = participantKey(participant) || `missing-id-${index}`;
    unique.set(key, { ...(unique.get(key) || {}), ...participant });
  });
  return [...unique.values()];
}

export function participantStats(participants = []) {
  const unique = uniqueProjectParticipants(participants);
  return {
    elderly: unique.length,
    packages: unique.filter((participant) => participant.receives === "כן").length,
    delivered: unique.filter((participant) => participant.delivery === "נמסר").length,
    assigned: unique.filter(hasProjectAssignment).length,
    notes: unique.filter(hasSpecialNote).length,
  };
}

export function neighborhoodNoteEntries(participants = []) {
  return uniqueProjectParticipants(participants)
    .filter(hasSpecialNote)
    .map((participant) => ({
      id: participantKey(participant),
      name: `${participant.first || participant.firstName || ""} ${
        participant.last || participant.lastName || ""
      }`.trim() || "ללא שם",
      note: participant.notes.trim(),
    }));
}
