export function getFlowTrackLength(partnerCount, spacing, viewportWidth) {
  const count = Math.max(0, Number(partnerCount) || 0);
  const safeSpacing = Math.max(1, Number(spacing) || 1);
  const width = Math.max(0, Number(viewportWidth) || 0);

  return Math.max(count * safeSpacing, width + safeSpacing * 2);
}
