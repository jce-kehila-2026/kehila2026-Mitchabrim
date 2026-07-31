const uniqueBy = (items, keyFor) => {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const text = (...values) => values.find((value) => (
  typeof value === "string" && value.trim()
))?.trim() || "";

const fullName = (record = {}) => text(
  record.fullName,
  `${record.firstName || record.first || ""} ${record.lastName || record.last || ""}`.trim(),
  record.name,
);

export const INDEPENDENT_GROUP_VALUE = "__independent__";
export const INDEPENDENT_GROUP_LABEL = "עצמאיים";

const deliveredParticipant = (participant) => participant.delivery === "נמסר";

const dateValue = (project = {}) => {
  const candidate = project.date || project.startDate || project.distributionDate;
  if (candidate?.toDate) return candidate.toDate().getTime();
  if (candidate?.seconds) return candidate.seconds * 1000;
  if (candidate) {
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const year = Number(project.year);
  return Number.isFinite(year) ? new Date(year, 0, 1).getTime() : Number.POSITIVE_INFINITY;
};

export function sortProjectReportsChronologically(projects = []) {
  return [...projects].sort((a, b) => {
    const difference = dateValue(a) - dateValue(b);
    if (difference) return difference;
    return String(a.name || "").localeCompare(String(b.name || ""), "he");
  });
}

const summarizeParticipants = (participants) => {
  const delivered = participants.filter(deliveredParticipant).length;
  return {
    elderly: participants.length,
    packages: participants.filter((item) => item.receives === "כן").length,
    delivered,
    notDelivered: participants.filter((item) => item.delivery && !deliveredParticipant(item)).length,
    assigned: participants.filter((item) => item.assignedGroupId || item.assignedVolunteerId).length,
    progress: participants.length ? Math.round((delivered / participants.length) * 100) : 0,
  };
};

export function buildProjectReports({
  projects = [],
  participantsByProject = {},
  groupsByProject = {},
  elderly = [],
  groups = [],
  volunteers = [],
} = {}) {
  const elderlyMap = new Map(elderly.map((item) => [String(item.id), item]));
  const groupMap = new Map(groups.map((item) => [String(item.id), item]));
  const volunteerMap = new Map(volunteers.map((item) => [String(item.id), item]));

  return projects.map((project) => {
    const participants = uniqueBy(
      participantsByProject[project.id] || [],
      (item) => String(item.elderlyId || item.id || ""),
    ).map((snapshot) => {
      const elderlyId = String(snapshot.elderlyId || snapshot.id || "");
      const current = elderlyMap.get(elderlyId) || {};
      const regularVolunteerId = String(snapshot.volId || current.volId || "");
      const regularVolunteerRecord = volunteerMap.get(regularVolunteerId) || {};
      return {
        ...current,
        ...snapshot,
        id: elderlyId,
        elderlyId,
        fullName: fullName({ ...current, ...snapshot }),
        phone: text(snapshot.phone, current.mobile, current.homePhone, current.phone),
        address: text(snapshot.address, current.address),
        neighborhood: text(snapshot.neighborhood, current.neighborhood),
        regularVolunteerId,
        regularVolunteer: text(
          snapshot.volName,
          current.volName,
          fullName(regularVolunteerRecord),
        ),
      };
    });

    const participantStatsByGroup = new Map();
    participants.forEach((participant) => {
      const groupId = String(participant.assignedGroupId || "");
      if (!groupId) return;
      const stats = participantStatsByGroup.get(groupId) || { elderly: 0, packages: 0 };
      stats.elderly += 1;
      if (participant.receives === "כן") stats.packages += 1;
      participantStatsByGroup.set(groupId, stats);
    });

    const projectGroups = uniqueBy(
      groupsByProject[project.id] || [],
      (item) => String(item.id || ""),
    ).map((assignment) => {
      const group = groupMap.get(String(assignment.id)) || {};
      const volunteerIds = [...new Set((assignment.volunteerIds || []).map(String).filter(Boolean))];
      const assignedStats = participantStatsByGroup.get(String(assignment.id))
        || { elderly: 0, packages: 0 };
      return {
        ...group,
        ...assignment,
        id: String(assignment.id),
        name: text(group.name, assignment.name, assignment.id),
        contact: text(group.contact, group.contactPerson, group.coordinator),
        phone: text(group.phone, group.contactPhone),
        volunteers: volunteerIds.map((id) => volunteerMap.get(id))
          .filter(Boolean)
          .map((volunteer) => ({
            ...volunteer,
            id: String(volunteer.id),
            fullName: fullName(volunteer),
          })),
        volunteerIds,
        assignedElderly: assignedStats.elderly,
        assignedPackages: assignedStats.packages,
      };
    });
    const projectGroupNameMap = new Map(projectGroups.map((group) => [group.id, group.name]));
    participants.forEach((participant) => {
      const groupId = String(participant.assignedGroupId || "");
      const referencedGroup = groupMap.get(groupId);
      if (groupId && referencedGroup && !projectGroupNameMap.has(groupId)) {
        projectGroupNameMap.set(groupId, text(referencedGroup.name, groupId));
      }
    });
    const reportParticipants = participants.map((participant) => ({
      ...participant,
      assignedGroupName: projectGroupNameMap.get(String(participant.assignedGroupId || "")) || "",
      assignedVolunteerName: text(
        participant.assignedVolunteerName,
        fullName(volunteerMap.get(String(participant.assignedVolunteerId || "")) || {}),
      ),
      assignmentLabel: participant.assignedGroupId
        ? projectGroupNameMap.get(String(participant.assignedGroupId)) || ""
        : participant.assignedVolunteerId
          ? INDEPENDENT_GROUP_LABEL
          : "",
    }));

    const participantSummary = summarizeParticipants(reportParticipants);
    const issueNotes = reportParticipants.filter((item) => text(item.notes)).length;
    const groupNames = [...new Set(projectGroupNameMap.values())].filter(Boolean);
    const independentParticipants = reportParticipants.filter((item) => item.assignedVolunteerId);
    const groupOptions = [...projectGroupNameMap].map(([id, name]) => ({
      value: `group:${id}`,
      label: name,
    }));
    if (independentParticipants.length) {
      groupOptions.push({ value: INDEPENDENT_GROUP_VALUE, label: INDEPENDENT_GROUP_LABEL });
    }
    const volunteerNames = uniqueBy(
      projectGroups.flatMap((group) => group.volunteers),
      (volunteer) => volunteer.id,
    ).map((volunteer) => volunteer.fullName).filter(Boolean);
    const neighborhoods = [...new Set(reportParticipants.map((item) => item.neighborhood).filter(Boolean))];

    return {
      ...project,
      participants: reportParticipants,
      projectGroups,
      ...participantSummary,
      issueCount: issueNotes,
      issues: text(project.issues, project.notesText, project.notes),
      groupList: groupNames,
      groupOptions,
      independentParticipants,
      independentCount: independentParticipants.length,
      groupNames: groupNames.join(", "),
      volunteerNames,
      volunteerNamesText: volunteerNames.join(", "),
      neighborhoods,
      neighborhoodsText: neighborhoods.join(", "),
    };
  });
}

export function filterProjectReports(projects, filters = {}) {
  return (projects || []).filter((project) => Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    if (key === "projectGroup") return project.groupOptions?.some((option) => option.value === value);
    if (key === "projectId") return String(project.id) === String(value);
    return String(project[key] ?? "") === String(value);
  })).map((project) => {
    const groupFilter = filters.projectGroup;
    if (!groupFilter) return project;
    const participants = project.participants.filter((participant) => (
      groupFilter === INDEPENDENT_GROUP_VALUE
        ? Boolean(participant.assignedVolunteerId)
        : String(participant.assignedGroupId || "") === groupFilter.replace(/^group:/, "")
    ));
    const projectGroups = groupFilter === INDEPENDENT_GROUP_VALUE
      ? []
      : project.projectGroups.filter((group) => `group:${group.id}` === groupFilter);
    return {
      ...project,
      ...summarizeParticipants(participants),
      participants,
      projectGroups,
      independentParticipants: participants.filter((item) => item.assignedVolunteerId),
      independentCount: participants.filter((item) => item.assignedVolunteerId).length,
    };
  });
}

export function projectPrintSections(project) {
  return [
    {
      title: "פרטי הפרויקט",
      kind: "metadata",
      entries: [
        ["שם", project.name],
        ["סוג / אירוע", project.type || project.holiday],
        ["שנה", project.year],
        ["תאריך התחלה", project.startDate],
        ["תאריך חלוקה", project.date],
        ["סטטוס", project.status],
        ["אזרחים ותיקים", project.elderly],
        ["חבילות", project.packages],
        ["נמסרו", project.delivered],
        ["לא נמסרו", project.notDelivered],
        ["עצמאיים", project.independentCount],
        ["שובצו", project.assigned],
        ["הערות / בעיות", project.issues],
      ],
    },
    {
      title: `אזרחים ותיקים (${project.participants.length})`,
      columns: [
        ["fullName", "שם מלא"],
        ["phone", "טלפון"],
        ["address", "כתובת"],
        ["neighborhood", "שכונה"],
        ["receives", "מקבל חבילה"],
        ["delivery", "סטטוס מסירה"],
        ["assignmentLabel", "קבוצה / גורם אחראי"],
        ["assignedVolunteerName", "מתנדב עצמאי"],
        ["regularVolunteer", "מתנדב קבוע"],
        ["notes", "הערות"],
      ],
      rows: project.participants,
    },
    {
      title: `קבוצות משתתפות (${project.projectGroups.length})`,
      columns: [
        ["name", "שם קבוצה"],
        ["contact", "איש קשר"],
        ["phone", "טלפון"],
        ["volunteerCount", "מתנדבים"],
        ["volunteerNames", "שמות מתנדבים"],
        ["assignedElderly", "אזרחים משויכים"],
        ["assignedPackages", "חבילות"],
      ],
      rows: project.projectGroups.map((group) => ({
        ...group,
        volunteerCount: group.volunteers.length,
        volunteerNames: group.volunteers.map((volunteer) => volunteer.fullName).filter(Boolean).join(", "),
      })),
    },
  ];
}
