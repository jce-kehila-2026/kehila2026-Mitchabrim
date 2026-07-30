export const PROFILE_UPDATE_RETENTION_MONTHS = 2;

export function profileUpdateRequestExpiryDate(reviewedAt) {
  const source = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  if (Number.isNaN(source.getTime())) {
    throw new TypeError("reviewedAt must be a valid date");
  }

  const year = source.getUTCFullYear();
  const targetMonthIndex = source.getUTCMonth() + PROFILE_UPDATE_RETENTION_MONTHS;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(source.getUTCDate(), lastDay);

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
}
