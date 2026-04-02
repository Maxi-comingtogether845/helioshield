/**
 * GlobalSim Helioshield — Event Fusion Engine
 *
 * Merges solar wind, flare, and CME data streams into a unified timeline.
 * Detects compound events (e.g., CME + flare within temporal window).
 * Applies data quality flags.
 */

import type {
  SolarWindSample,
  FlareEvent,
  CMEEvent,
  GeomagneticIndexSample,
} from '../domain/models';
import type { DataQuality } from '../domain/enums';
import type { IngestResult } from './ingest-service';

/** Temporal window for associating flares with CMEs (hours) */
const FLARE_CME_ASSOCIATION_WINDOW_MS = 6 * 3600_000;

export interface FusedTimeline {
  /** Solar wind samples sorted by time */
  solarWind: SolarWindSample[];
  /** All flare events (GOES + DONKI deduplicated) */
  flares: FlareEvent[];
  /** CME events with linked flares */
  cmes: CMEEvent[];
  /** Official Kp reference values */
  officialKp: GeomagneticIndexSample[];
  /** Latest solar wind snapshot (or null if unavailable) */
  latestSolarWind: SolarWindSample | null;
  /** Sources currently in degraded state */
  degradedSources: string[];
  /** Overall data quality */
  overallQuality: DataQuality;
}

export class EventFusionEngine {
  /**
   * Merge all ingest results into a unified timeline.
   */
  fuse(ingest: IngestResult): FusedTimeline {
    const solarWind = this.deduplicateByTimestamp(ingest.solarWind.data);
    const goesFlares = ingest.xrayFlares.data;
    const donkiFlares = ingest.donkiFlares.data;
    const cmes = ingest.donkiCMEs.data;
    const officialKp = ingest.officialKp.data;

    // Merge & deduplicate flares from GOES detection and DONKI events
    const mergedFlares = this.mergeFlares(goesFlares, donkiFlares);

    // Associate flares with CMEs by temporal proximity
    const linkedCmes = this.linkFlaresToCMEs(mergedFlares, cmes);

    // Get latest valid solar wind sample
    const latestSolarWind =
      solarWind.length > 0 ? solarWind[solarWind.length - 1] : null;

    return {
      solarWind,
      flares: mergedFlares,
      cmes: linkedCmes,
      officialKp,
      latestSolarWind,
      degradedSources: ingest.degradedSources,
      overallQuality: ingest.overallQuality,
    };
  }

  /**
   * Remove duplicate solar wind samples by timestamp.
   * Keeps the latest (most complete) sample for each timestamp.
   */
  private deduplicateByTimestamp(samples: SolarWindSample[]): SolarWindSample[] {
    const map = new Map<string, SolarWindSample>();
    for (const s of samples) {
      const existing = map.get(s.timestamp_utc);
      if (!existing || this.sampleCompleteness(s) > this.sampleCompleteness(existing)) {
        map.set(s.timestamp_utc, s);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
    );
  }

  private sampleCompleteness(s: SolarWindSample): number {
    let count = 0;
    if (s.density_p_cc != null) count++;
    if (s.speed_km_s != null) count++;
    if (s.temperature_k != null) count++;
    if (s.bx_nT != null) count++;
    if (s.by_nT != null) count++;
    if (s.bz_nT != null) count++;
    if (s.bt_nT != null) count++;
    return count;
  }

  /**
   * Merge GOES-detected flares with DONKI flares.
   * DONKI events take priority for metadata (location, active region).
   * GOES detections fill in peak flux if missing from DONKI.
   */
  private mergeFlares(goesFlares: FlareEvent[], donkiFlares: FlareEvent[]): FlareEvent[] {
    // DONKI flares are canonical — index by peak time for matching
    const donkiByPeak = new Map<string, FlareEvent>();
    for (const f of donkiFlares) {
      if (f.peak_time_utc) {
        donkiByPeak.set(f.peak_time_utc, f);
      }
    }

    // Check each GOES detection against DONKI events
    const merged: FlareEvent[] = [...donkiFlares];
    for (const goesFlare of goesFlares) {
      const peakTime = goesFlare.peak_time_utc;
      if (!peakTime) continue;

      // Check if a DONKI flare exists within ±30 minutes
      let matched = false;
      for (const [donkiPeak, donkiFlare] of donkiByPeak) {
        const timeDiff = Math.abs(
          new Date(peakTime).getTime() - new Date(donkiPeak).getTime()
        );
        if (timeDiff < 30 * 60_000) {
          // Enrich DONKI flare with GOES peak flux if missing
          if (!donkiFlare.peak_flux_wm2 && goesFlare.peak_flux_wm2) {
            donkiFlare.peak_flux_wm2 = goesFlare.peak_flux_wm2;
          }
          matched = true;
          break;
        }
      }

      // If no DONKI match, keep the GOES detection
      if (!matched) {
        merged.push(goesFlare);
      }
    }

    return merged.sort(
      (a, b) => new Date(a.begin_time_utc).getTime() - new Date(b.begin_time_utc).getTime()
    );
  }

  /**
   * Link CMEs to proximate flares that aren't already associated.
   */
  private linkFlaresToCMEs(flares: FlareEvent[], cmes: CMEEvent[]): CMEEvent[] {
    return cmes.map((cme) => {
      if (cme.associated_flare_ids.length > 0) return cme;

      // Find flares within the association window
      const cmeTime = new Date(cme.start_time_utc).getTime();
      const nearbyFlareIds = flares
        .filter((f) => {
          const flareTime = new Date(f.begin_time_utc).getTime();
          return Math.abs(flareTime - cmeTime) < FLARE_CME_ASSOCIATION_WINDOW_MS;
        })
        .map((f) => f.id);

      return { ...cme, associated_flare_ids: nearbyFlareIds };
    });
  }
}
