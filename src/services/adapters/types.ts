/**
 * GlobalSim Helioshield — Data Source Adapter Interface
 *
 * Adapter pattern: each data source implements this interface.
 * The ingest service treats all sources uniformly.
 */

import type { DataQuality } from '../../domain/enums';

/** Result of a single adapter fetch */
export interface AdapterResult<T> {
  /** The normalized data array */
  data: T[];
  /** Data quality assessment */
  quality: DataQuality;
  /** ISO 8601 timestamp of when data was fetched */
  fetchedAt: string;
  /** Human-readable source identifier */
  source: string;
  /** Whether data came from cache */
  fromCache: boolean;
  /** Error message if fetch failed (data may still be present from fallback) */
  error?: string;
}

/**
 * Generic adapter interface.
 *
 * @typeParam TRaw - the raw API response type
 * @typeParam TNorm - the normalized domain model type
 */
export interface DataSourceAdapter<TRaw, TNorm> {
  /** Unique identifier for this adapter */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;

  /**
   * Fetch data from the source.
   * Handles caching, retry, and rate limiting internally.
   * Returns fallback data on failure (never throws).
   */
  fetch(): Promise<AdapterResult<TNorm>>;

  /**
   * Parse raw API response into typed raw objects.
   * Throws on structural parse failure.
   */
  parseRaw(response: unknown): TRaw[];

  /**
   * Validate and normalize raw objects into domain models.
   * Skips invalid entries, doesn't throw.
   */
  normalize(raw: TRaw[]): TNorm[];
}

/** Determines data freshness based on timestamp age */
export function assessQuality(
  newestTimestamp: string | null,
  expectedCadenceMs: number
): DataQuality {
  if (!newestTimestamp) return 'fallback';

  const age = Date.now() - new Date(newestTimestamp).getTime();
  if (age < expectedCadenceMs * 2) return 'fresh';
  if (age < expectedCadenceMs * 10) return 'delayed';
  return 'fallback';
}
