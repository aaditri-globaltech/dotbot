/**
 * Appearance of one heatmap cell, shaded by how busy the day was relative to
 * the busiest day in the visible window.
 */

const CELL_CLASSES = [
  "bg-surface-hover",
  "bg-accent/30",
  "bg-accent/50",
  "bg-accent/75",
  "bg-accent",
];

const BUSIEST_LEVEL = CELL_CLASSES.length - 1;

/** Background class for a day's cell, from empty (level 0) to busiest. */
export function intensityClass(count: number, maxCount: number): string {
  if (count <= 0 || maxCount <= 0) return CELL_CLASSES[0];
  const level = Math.min(
    Math.ceil((count / maxCount) * BUSIEST_LEVEL),
    BUSIEST_LEVEL,
  );
  return CELL_CLASSES[level];
}
