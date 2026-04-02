/**
 * GlobalSim Helioshield — NOAA Solar Wind Adapter
 *
 * Fetches plasma (density, speed, temperature) and magnetic field (Bx, By, Bz, Bt)
 * data from NOAA SWPC DSCOVR real-time solar wind JSON endpoints.
 *
 * Data format: Array of arrays. First row is headers, subsequent rows are data.
 * Timestamps are in "YYYY-MM-DD HH:mm:ss.SSS" format (UTC, no Z suffix).
 *
 * Coordinate system: GSM (Geocentric Solar Magnetospheric) for magnetic field.
 */

import { z } from 'zod';
import type { SolarWindSample } from '../../domain/models';
import { SolarWindSampleSchema } from '../../domain/models';
import type { DataSourceAdapter, AdapterResult } from './types';
import { assessQuality } from './types';
import { globalCache } from '../../lib/cache';
import { withRetry } from '../../lib/retry';
import { toISOUTC } from '../../lib/time';
import { DATA_SOURCES } from '../../config/data-sources';
import { vectorMagnitude } from '../../lib/math';

// ── Raw NOAA response validation ──────────────────────────────────────────────

/** NOAA solar wind plasma row: [time, density, speed, temperature] */
const PlasmaRowSchema = z.tuple([
  z.string(),            // timestamp
  z.string(),            // density (p/cc) — NOAA returns strings
  z.string(),            // speed (km/s)
  z.string(),            // temperature (K)
]);

/** NOAA solar wind mag row: [time, bx, by, bz, bt, lat, lon] */
const MagRowSchema = z.tuple([
  z.string(),            // timestamp
  z.string(),            // bx_gsm (nT)
  z.string(),            // by_gsm (nT)
  z.string(),            // bz_gsm (nT)
  z.string(),            // bt (nT)
  z.string(),            // lat_gsm (deg)
  z.string(),            // lon_gsm (deg)
]);

interface RawPlasma {
  timestamp: string;
  density: number | null;
  speed: number | null;
  temperature: number | null;
}

interface RawMag {
  timestamp: string;
  bx: number | null;
  by: number | null;
  bz: number | null;
  bt: number | null;
}

type RawSolarWind = RawPlasma & Partial<RawMag>;

function parseNumber(s: string): number | null {
  if (!s || s.trim() === '' || s.trim() === '-999.9' || s.trim() === '-99999.0') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export class NoaaSolarWindAdapter implements DataSourceAdapter<RawSolarWind, SolarWindSample> {
  readonly id = 'noaa_solar_wind';
  readonly name = 'NOAA SWPC Solar Wind (DSCOVR L1)';

  private readonly plasmaConfig = DATA_SOURCES.NOAA_SOLAR_WIND_PLASMA;
  private readonly magConfig = DATA_SOURCES.NOAA_SOLAR_WIND_MAG;

  async fetch(): Promise<AdapterResult<SolarWindSample>> {
    const cacheKey = `adapter:${this.id}`;
    const cached = globalCache.get<AdapterResult<SolarWindSample>>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    try {
      const [plasmaResp, magResp] = await Promise.allSettled([
        withRetry(() => fetch(this.plasmaConfig.url).then((r) => r.json()), {
          maxAttempts: this.plasmaConfig.retryAttempts,
          baseDelayMs: this.plasmaConfig.retryBaseDelayMs,
        }),
        withRetry(() => fetch(this.magConfig.url).then((r) => r.json()), {
          maxAttempts: this.magConfig.retryAttempts,
          baseDelayMs: this.magConfig.retryBaseDelayMs,
        }),
      ]);

      const plasmaRaw =
        plasmaResp.status === 'fulfilled' ? this.parsePlasma(plasmaResp.value) : [];
      const magRaw =
        magResp.status === 'fulfilled' ? this.parseMag(magResp.value) : [];

      const merged = this.mergeByTimestamp(plasmaRaw, magRaw);
      const normalized = this.normalize(merged);

      const newestTs = normalized.length > 0 ? normalized[normalized.length - 1].timestamp_utc : null;
      const quality = assessQuality(newestTs, 60_000);

      const result: AdapterResult<SolarWindSample> = {
        data: normalized,
        quality,
        fetchedAt: new Date().toISOString(),
        source: this.name,
        fromCache: false,
      };

      if (plasmaResp.status === 'rejected' || magResp.status === 'rejected') {
        result.error = 'Partial fetch failure — some data may be missing';
      }

      globalCache.set(cacheKey, result, this.plasmaConfig.cacheTtlMs);
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

  parseRaw(response: unknown): RawSolarWind[] {
    return this.parsePlasma(response);
  }

  private parsePlasma(response: unknown): RawPlasma[] {
    if (!Array.isArray(response) || response.length < 2) return [];

    // Skip header row
    return response.slice(1).reduce<RawPlasma[]>((acc, row) => {
      const parsed = PlasmaRowSchema.safeParse(row);
      if (!parsed.success) return acc;

      const [ts, density, speed, temp] = parsed.data;
      const timestamp = toISOUTC(ts);
      if (!timestamp) return acc;

      acc.push({
        timestamp,
        density: parseNumber(density),
        speed: parseNumber(speed),
        temperature: parseNumber(temp),
      });
      return acc;
    }, []);
  }

  private parseMag(response: unknown): RawMag[] {
    if (!Array.isArray(response) || response.length < 2) return [];

    return response.slice(1).reduce<RawMag[]>((acc, row) => {
      const parsed = MagRowSchema.safeParse(row);
      if (!parsed.success) return acc;

      const [ts, bx, by, bz, bt] = parsed.data;
      const timestamp = toISOUTC(ts);
      if (!timestamp) return acc;

      acc.push({
        timestamp,
        bx: parseNumber(bx),
        by: parseNumber(by),
        bz: parseNumber(bz),
        bt: parseNumber(bt),
      });
      return acc;
    }, []);
  }

  private mergeByTimestamp(plasma: RawPlasma[], mag: RawMag[]): RawSolarWind[] {
    const magMap = new Map(mag.map((m) => [m.timestamp, m]));
    return plasma.map((p) => {
      const m = magMap.get(p.timestamp);
      return {
        ...p,
        bx: m?.bx ?? null,
        by: m?.by ?? null,
        bz: m?.bz ?? null,
        bt: m?.bt ?? null,
      };
    });
  }

  normalize(raw: RawSolarWind[]): SolarWindSample[] {
    return raw.reduce<SolarWindSample[]>((acc, r) => {
      const hasMag = r.bx != null || r.by != null || r.bz != null;
      const hasPlasma = r.density != null || r.speed != null;

      let quality: SolarWindSample['quality'] = 'fresh';
      if (!hasPlasma && !hasMag) return acc; // Skip empty rows
      if (!hasPlasma || !hasMag) quality = 'sparse';

      const computedBt =
        r.bt ?? (r.bx != null && r.by != null && r.bz != null
          ? vectorMagnitude(r.bx, r.by, r.bz)
          : null);

      const sample: SolarWindSample = {
        timestamp_utc: r.timestamp,
        density_p_cc: r.density ?? null,
        speed_km_s: r.speed ?? null,
        temperature_k: r.temperature ?? null,
        bx_nT: r.bx ?? null,
        by_nT: r.by ?? null,
        bz_nT: r.bz ?? null,
        bt_nT: computedBt,
        quality,
        source: this.name,
      };

      const validated = SolarWindSampleSchema.safeParse(sample);
      if (validated.success) acc.push(validated.data);
      return acc;
    }, []);
  }
}
