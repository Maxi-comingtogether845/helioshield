/**
 * GlobalSim Helioshield — NASA DONKI Adapter
 *
 * Fetches CME and Solar Flare events from NASA DONKI API.
 *
 * Authentication: NASA API key via VITE_NASA_API_KEY env var.
 * Default: DEMO_KEY (30 req/hr limit).
 *
 * CME response: Array of objects with activityID, startTime, cmeAnalyses, etc.
 * FLR response: Array of objects with flrID, beginTime, peakTime, endTime, classType, etc.
 */

import { z } from 'zod';
import type { CMEEvent, FlareEvent } from '../../domain/models';
import { CMEEventSchema, FlareEventSchema } from '../../domain/models';
import type { AdapterResult } from './types';
import { assessQuality } from './types';
import { globalCache } from '../../lib/cache';
import { withRetry } from '../../lib/retry';
import { toISOUTC, formatDateYMD } from '../../lib/time';
import { DATA_SOURCES, buildDonkiUrl } from '../../config/data-sources';
import type { FlareClass } from '../../domain/enums';

// ── Raw DONKI schemas ─────────────────────────────────────────────────────────

const DonkiCMEAnalysisSchema = z.object({
  speed: z.number().nullable().optional(),
  halfAngle: z.number().nullable().optional(),
  isMostAccurate: z.boolean().optional(),
  type: z.string().optional(),
});

const DonkiCMESchema = z.object({
  activityID: z.string(),
  startTime: z.string(),
  cmeAnalyses: z.array(DonkiCMEAnalysisSchema).nullable().optional(),
  linkedEvents: z.array(z.object({
    activityID: z.string(),
  })).nullable().optional(),
});

const DonkiFLRSchema = z.object({
  flrID: z.string(),
  beginTime: z.string(),
  peakTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  classType: z.string(),
  sourceLocation: z.string().nullable().optional(),
  activeRegionNum: z.number().nullable().optional(),
  linkedEvents: z.array(z.object({
    activityID: z.string(),
  })).nullable().optional(),
});

// ── Adapter ───────────────────────────────────────────────────────────────────

export class NasaDonkiAdapter {
  readonly id = 'nasa_donki';
  readonly name = 'NASA DONKI (CME + Flare Events)';

  /**
   * Fetch CME events from the last N days.
   */
  async fetchCMEs(lookbackDays: number = 30): Promise<AdapterResult<CMEEvent>> {
    const cacheKey = `adapter:${this.id}:cme`;
    const cached = globalCache.get<AdapterResult<CMEEvent>>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackDays * 86_400_000);
    const url = buildDonkiUrl(
      'NASA_DONKI_CME',
      formatDateYMD(startDate),
      formatDateYMD(endDate)
    );

    try {
      const response = await withRetry(
        () => fetch(url).then((r) => r.json()),
        {
          maxAttempts: DATA_SOURCES.NASA_DONKI_CME.retryAttempts,
          baseDelayMs: DATA_SOURCES.NASA_DONKI_CME.retryBaseDelayMs,
        }
      );

      const cmes = this.parseCMEs(response);
      const newestTs = cmes.length > 0 ? cmes[cmes.length - 1].start_time_utc : null;

      const result: AdapterResult<CMEEvent> = {
        data: cmes,
        quality: assessQuality(newestTs, 86_400_000),
        fetchedAt: new Date().toISOString(),
        source: this.name,
        fromCache: false,
      };

      globalCache.set(cacheKey, result, DATA_SOURCES.NASA_DONKI_CME.cacheTtlMs);
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

  /**
   * Fetch flare events from the last N days.
   */
  async fetchFlares(lookbackDays: number = 7): Promise<AdapterResult<FlareEvent>> {
    const cacheKey = `adapter:${this.id}:flr`;
    const cached = globalCache.get<AdapterResult<FlareEvent>>(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackDays * 86_400_000);
    const url = buildDonkiUrl(
      'NASA_DONKI_FLR',
      formatDateYMD(startDate),
      formatDateYMD(endDate)
    );

    try {
      const response = await withRetry(
        () => fetch(url).then((r) => r.json()),
        {
          maxAttempts: DATA_SOURCES.NASA_DONKI_FLR.retryAttempts,
          baseDelayMs: DATA_SOURCES.NASA_DONKI_FLR.retryBaseDelayMs,
        }
      );

      const flares = this.parseFlares(response);
      const newestTs = flares.length > 0 ? flares[flares.length - 1].begin_time_utc : null;

      const result: AdapterResult<FlareEvent> = {
        data: flares,
        quality: assessQuality(newestTs, 86_400_000),
        fetchedAt: new Date().toISOString(),
        source: this.name,
        fromCache: false,
      };

      globalCache.set(cacheKey, result, DATA_SOURCES.NASA_DONKI_FLR.cacheTtlMs);
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

  private parseCMEs(response: unknown): CMEEvent[] {
    if (!Array.isArray(response)) return [];

    return response.reduce<CMEEvent[]>((acc, item) => {
      const parsed = DonkiCMESchema.safeParse(item);
      if (!parsed.success) return acc;

      const d = parsed.data;
      const startTime = toISOUTC(d.startTime);
      if (!startTime) return acc;

      // Use the most accurate analysis, or the first one
      const analyses = d.cmeAnalyses ?? [];
      const bestAnalysis =
        analyses.find((a) => a.isMostAccurate) ?? analyses[0] ?? null;

      const speed = bestAnalysis?.speed ?? null;
      const halfAngle = bestAnalysis?.halfAngle ?? null;

      // Simple halo check: halfAngle >= 60° suggests Earth-directed
      const isEarthDirected = halfAngle != null ? halfAngle >= 60 : false;

      // Linked flare IDs
      const flareIds = (d.linkedEvents ?? [])
        .map((e) => e.activityID)
        .filter((id) => id.includes('FLR'));

      const cme: CMEEvent = {
        id: d.activityID,
        start_time_utc: startTime,
        speed_km_s: speed,
        half_angle_deg: halfAngle,
        is_earth_directed: isEarthDirected,
        estimated_arrival_utc: null, // Computed later by propagation-estimator
        estimated_arrival_speed_km_s: null,
        arrival_confidence: 0,
        associated_flare_ids: flareIds,
        quality: 'fresh',
        source: this.name,
      };

      const validated = CMEEventSchema.safeParse(cme);
      if (validated.success) acc.push(validated.data);
      return acc;
    }, []);
  }

  private parseFlares(response: unknown): FlareEvent[] {
    if (!Array.isArray(response)) return [];

    return response.reduce<FlareEvent[]>((acc, item) => {
      const parsed = DonkiFLRSchema.safeParse(item);
      if (!parsed.success) return acc;

      const d = parsed.data;
      const beginTime = toISOUTC(d.beginTime);
      if (!beginTime) return acc;

      // Parse class: "M2.3" → class="M", magnitude=2.3
      const classMatch = d.classType.match(/^([ABCMX])(\d+\.?\d*)?$/i);
      if (!classMatch) return acc;

      const flareClass = classMatch[1].toUpperCase() as FlareClass;
      const magnitude = classMatch[2] ? parseFloat(classMatch[2]) : 1.0;

      // Parse source location: "N23E45" → lat=23, lon=45
      let srcLat: number | null = null;
      let srcLon: number | null = null;
      if (d.sourceLocation) {
        const locMatch = d.sourceLocation.match(/([NS])(\d+)([EW])(\d+)/i);
        if (locMatch) {
          srcLat = parseInt(locMatch[2]) * (locMatch[1].toUpperCase() === 'N' ? 1 : -1);
          srcLon = parseInt(locMatch[4]) * (locMatch[3].toUpperCase() === 'E' ? 1 : -1);
        }
      }

      const flare: FlareEvent = {
        id: d.flrID,
        begin_time_utc: beginTime,
        peak_time_utc: toISOUTC(d.peakTime ?? null),
        end_time_utc: toISOUTC(d.endTime ?? null),
        flare_class: flareClass,
        class_magnitude: magnitude,
        peak_flux_wm2: null, // DONKI doesn't always include peak flux
        source_lat_deg: srcLat,
        source_lon_deg: srcLon,
        active_region: d.activeRegionNum ?? null,
        quality: 'fresh',
        source: this.name,
      };

      const validated = FlareEventSchema.safeParse(flare);
      if (validated.success) acc.push(validated.data);
      return acc;
    }, []);
  }
}
