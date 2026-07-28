const timestampValue = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    const byDate = timestampValue(b.createdAt) - timestampValue(a.createdAt);
    if (byDate) return byDate;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function mergeUniqueNewestFirst(current, incoming) {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return sortNewestFirst([...byId.values()]);
}

export async function loadInitialVolunteerTasks({
  volunteerId,
  authUid,
  pageSize = 20,
  getVolunteerPage,
  getVolunteerCount,
  getAuthPage,
  getAuthCount,
}) {
  if (volunteerId) {
    const [pageResult, count] = await Promise.all([
      getVolunteerPage({ volunteerId, pageSize }),
      getVolunteerCount(volunteerId),
    ]);
    if (pageResult.items.length > 0) {
      return { pageResult, count, mode: "volunteerId" };
    }
  }

  if (authUid) {
    const [pageResult, count] = await Promise.all([
      getAuthPage({ authUid, pageSize }),
      getAuthCount(authUid),
    ]);
    return { pageResult, count, mode: "authUid" };
  }

  return {
    pageResult: { items: [], lastVisible: null, hasNextPage: false },
    count: 0,
    mode: null,
  };
}
