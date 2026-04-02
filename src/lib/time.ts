/**
 * GlobalSim Helioshield — Time Utilities
 *
 * All timestamps in the system are UTC ISO 8601.
 * These utilities handle parsing, validation, and formatting.
 *
 * Assumption: All NOAA/NASA APIs return timestamps in UTC.
 * We normalize everything to ISO 8601 with 'Z' suffix.
 */

/**
 * Parse a timestamp string to a Date object.
 * Handles common NOAA/NASA formats:
 *   - "2024-01-15 12:30:00.000"  (NOAA solar wind — space-separated, no Z)
 *   - "2024-01-15T12:30:00Z"    (ISO 8601)
 *   - "2024-01-15T12:30Z"       (ISO 8601 short)
 *
 * Returns null if parsing fails.
 */
export function parseTimestamp(raw: string): Date | null {
  if (!raw || typeof raw !== 'string') return null;

  // NOAA uses space-separated format without timezone — assume UTC
  const normalized = raw.trim().replace(' ', 'T');
  const withZ = normalized.endsWith('Z') ? normalized : `${normalized}Z`;

  const date = new Date(withZ);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Convert a Date or string to ISO 8601 UTC string.
 * Returns null if conversion fails.
 */
export function toISOUTC(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const date = typeof input === 'string' ? parseTimestamp(input) : input;
  if (!date) return null;
  return date.toISOString();
}

/**
 * Get the age of a timestamp in milliseconds from now.
 */
export function timestampAgeMs(timestamp: string): number {
  const date = parseTimestamp(timestamp);
  if (!date) return Infinity;
  return Date.now() - date.getTime();
}

/**
 * Check if a timestamp is within the last N minutes.
 */
export function isWithinMinutes(timestamp: string, minutes: number): boolean {
  return timestampAgeMs(timestamp) <= minutes * 60_000;
}

/**
 * Format a Date as YYYY-MM-DD for DONKI API date parameters.
 */
export function formatDateYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a relative time string for display.
 * "2 minutes ago", "3 hours ago", etc.
 */
export function relativeTime(timestamp: string): string {
  const ageMs = timestampAgeMs(timestamp);
  if (ageMs < 0) return 'in the future';

  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
