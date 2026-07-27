/** e.g. "Feb 14, 2025" */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** ISO date (YYYY-MM-DD) for <time datetime> */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
