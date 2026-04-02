/**
 * GlobalSim Helioshield — NOAA Kp Index Adapter
 *
 * Fetches the official Planetary K-index from NOAA SWPC.
 *
 * Data format: Array of arrays. First row is headers.
 * Columns: time_tag, Kp, Kp_fraction, a_running, station_count
 * Timestamps: "YYYY-MM-DD HH:mm:ss.SSS" (UTC)
 *
 * These are OFFICIAL reference values — labeled as DataOrigin.OfficialReference.
 */

import { z } from 'zod';
import type { GeomagneticIndexSample } from '../../domain/models';
import { GeomagneticIndexSampleSchema } from '../../domain/models';
import type { DataSourceAdapter, AdapterResult } from './types';
import { assessQuality } from './types';
import { globalCache } from '../../lib/cache';
import { withRetry } from '../../lib/retry';
import { toISOUTC } from '../../lib/time';
import { DATA_SOURCES } from '../../config/data-sources';
import { KP_STORM_THRESHOLDS } from '../../config/constants';
import type { StormPhase } from '../../domain/enums';

const KpRowSchema = z.tuple([
  z.string(), // time_tag
  z.string(), // Kp
  z.string(), // Kp_fraction (unused — we use Kp as float)
  z.string(), // a_running
  z.string(), // station_count
]);

interface RawKp {
  timestamp: string;
  kp: number;
}

function kpToStormPhase(kp: number): StormPhase {
  if (kp >= KP_STORM_THRESHOLDS.EXTREME) return 'extreme_storm';
  if (kp >= KP_STORM_THRESHOLDS.SEVERE) return 'severe_storm';
  if (kp >= KP_STORM_THRESHOLDS.STRONG) return 'strong_storm';
  if (kp >= KP_STORM_THRESHOLDS.MODERATE) return 'moderate_storm';
  if (kp >= KP_STORM_THRESHOLDS.MINOR) return 'minor_storm';
  if (kp >= KP_STORM_THRESHOLDS.ACTIVE) return 'active';
  return 'quiet';
}

export class NoaaKpIndexAdapter implements DataSourceAdapter<RawKp, GeomagneticIndexSample> {
  readonly id = 'noaa_kp';
  readonly name = 'NOAA SWPC Planetary K-index (Official)';

  private readonly config = DATA_SOURCES.NOAA_KP_INDEX;

  async fetch(): Promise<AdapterResult<GeomagneticIndexSample>> {
    const cacheKey = `adapter:${this.id}`;
    const cached = globalCache.get<AdapterResult<GeomagneticIndexSample>>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    try {
      const response = await withRetry(
        () => fetch(this.config.url).then((r) => r.json()),
        {
          maxAttempts: this.config.retryAttempts,
          baseDelayMs: this.config.retryBaseDelayMs,
        }
      );

      const raw = this.parseRaw(response);
      const normalized = this.normalize(raw);
      const newestTs = normalized.length > 0 ? normalized[normalized.length - 1].timestamp_utc : null;
      const quality = assessQuality(newestTs, 3 * 3600_000); // 3-hour cadence

      const result: AdapterResult<GeomagneticIndexSample> = {
        data: normalized,
        quality,
        fetchedAt: new Date().toISOString(),
        source: this.name,
        fromCache: false,
      };

      globalCache.set(cacheKey, result, this.config.cacheTtlMs);
      return result;
    } catch (err) {
      return {
        data: [],
        quality: 'fallback',
        fetchedAt: new Date().toISOString(),
        source: this.name,
        fromCache: false,
        error: err instanceof Error ? err.message : 'Unknown fetch error',
      };
    }
  }

  parseRaw(response: unknown): RawKp[] {
    if (!Array.isArray(response) || response.length < 2) return [];

    return response.slice(1).reduce<RawKp[]>((acc, row) => {
      const parsed = KpRowSchema.safeParse(row);
      if (!parsed.success) return acc;

      const [ts, kpStr] = parsed.data;
      const timestamp = toISOUTC(ts);
      if (!timestamp) return acc;

      const kp = parseFloat(kpStr);
      if (isNaN(kp) || kp < 0 || kp > 9) return acc;

      acc.push({ timestamp, kp });
      return acc;
    }, []);
  }

  normalize(raw: RawKp[]): GeomagneticIndexSample[] {
    return raw.reduce<GeomagneticIndexSample[]>((acc, r) => {
      const sample: GeomagneticIndexSample = {
        timestamp_utc: r.timestamp,
        kp: r.kp,
        storm_phase: kpToStormPhase(r.kp),
        origin: 'official_reference',
        quality: 'fresh',
        source: this.name,
      };

      const validated = GeomagneticIndexSampleSchema.safeParse(sample);
      if (validated.success) acc.push(validated.data);
      return acc;
    }, []);
  }
}
