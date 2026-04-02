/**
 * GlobalSim Helioshield — GOES X-ray Flux Adapter
 *
 * Fetches GOES-16 primary 1–8 Å X-ray flux from NOAA SWPC.
 *
 * Data format: Array of objects with fields:
 *   time_tag, satellite, current_class, current_ratio,
 *   flux, observed_flux, electron_correction, electron_contaminaton,
 *   energy
 *
 * We use the "flux" field (W/m²) from the 0.1–0.8 nm (1–8 Å) channel.
 * Energy filter: "0.1-0.8nm"
 */

import { z } from 'zod';
import type { FlareEvent } from '../../domain/models';
import { FlareEventSchema } from '../../domain/models';
import type { DataSourceAdapter, AdapterResult } from './types';
import { assessQuality } from './types';
import { globalCache } from '../../lib/cache';
import { withRetry } from '../../lib/retry';
import { toISOUTC } from '../../lib/time';
import { DATA_SOURCES } from '../../config/data-sources';
import { FLARE_THRESHOLDS_WM2 } from '../../config/constants';
import { classifyFlareFlux } from '../../lib/units';
import type { FlareClass } from '../../domain/enums';

const GoesXrayRowSchema = z.object({
  time_tag: z.string(),
  flux: z.number(),
  energy: z.string(),
  observed_flux: z.number().optional(),
  current_class: z.string().optional(),
});

interface RawXray {
  timestamp: string;
  flux: number;
  flareClass: FlareClass;
  magnitude: number;
}

/**
 * Detect flare peaks: a flare is a local maximum in X-ray flux
 * above C-class threshold (1×10⁻⁶ W/m²).
 */
function detectFlares(points: RawXray[]): RawXray[] {
  if (points.length < 3) return [];
  const flares: RawXray[] = [];
  const C_THRESHOLD = FLARE_THRESHOLDS_WM2.B_MAX; // ≥ C class

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].flux;
    const curr = points[i].flux;
    const next = points[i + 1].flux;

    if (curr > prev && curr > next && curr >= C_THRESHOLD) {
      flares.push(points[i]);
    }
  }

  return flares;
}

export class GoesXrayAdapter implements DataSourceAdapter<RawXray, FlareEvent> {
  readonly id = 'goes_xray';
  readonly name = 'GOES-16 X-ray Flux (1–8 Å)';

  private readonly config = DATA_SOURCES.GOES_XRAY;

  async fetch(): Promise<AdapterResult<FlareEvent>> {
    const cacheKey = `adapter:${this.id}`;
    const cached = globalCache.get<AdapterResult<FlareEvent>>(cacheKey);
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
      const newestTs = normalized.length > 0 ? normalized[normalized.length - 1].peak_time_utc : null;
      const quality = assessQuality(newestTs, 60_000);

      const result: AdapterResult<FlareEvent> = {
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

  parseRaw(response: unknown): RawXray[] {
    if (!Array.isArray(response)) return [];

    const longChannel = response.filter((row: Record<string, unknown>) => {
      const parsed = GoesXrayRowSchema.safeParse(row);
      return parsed.success && parsed.data.energy === '0.1-0.8nm';
    });

    return longChannel.reduce<RawXray[]>((acc, row) => {
      const parsed = GoesXrayRowSchema.safeParse(row);
      if (!parsed.success) return acc;

      const ts = toISOUTC(parsed.data.time_tag);
      if (!ts) return acc;

      const flux = parsed.data.flux;
      if (flux <= 0) return acc;

      const { cls, magnitude } = classifyFlareFlux(flux);

      acc.push({
        timestamp: ts,
        flux,
        flareClass: cls as FlareClass,
        magnitude,
      });
      return acc;
    }, []);
  }

  normalize(raw: RawXray[]): FlareEvent[] {
    // Detect peaks and convert to FlareEvent
    const peaks = detectFlares(raw);

    return peaks.reduce<FlareEvent[]>((acc, peak, i) => {
      const event: FlareEvent = {
        id: `goes_xray_${peak.timestamp}_${i}`,
        begin_time_utc: peak.timestamp, // Simplified — peak ≈ begin for detection
        peak_time_utc: peak.timestamp,
        end_time_utc: null,
        flare_class: peak.flareClass,
        class_magnitude: peak.magnitude,
        peak_flux_wm2: peak.flux,
        source_lat_deg: null, // Not available from GOES flux alone
        source_lon_deg: null,
        active_region: null,
        quality: 'fresh',
        source: this.name,
      };

      const validated = FlareEventSchema.safeParse(event);
      if (validated.success) acc.push(validated.data);
      return acc;
    }, []);
  }
}
