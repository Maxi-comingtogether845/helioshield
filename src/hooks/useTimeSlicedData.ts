/**
 * GlobalSim Helioshield — useTimeSlicedData Hook
 *
 * Slices the full timeline data to the playback cursor position.
 * All panels receive data sliced to the same timestamp, ensuring synchronization.
 *
 * Design:
 *   - In 'live' mode, returns all data as-is (no slicing)
 *   - In playback mode, filters to data <= currentTime
 *   - Recomputes magnetosphere + impacts for the sample at cursor
 *   - Preserves quality flags and degraded sources
 */

import { useMemo } from 'react';
import {
  MagnetosphereResponseEstimator,
  type MagnetosphereResult,
} from '../services/magnetosphere-response';
import { ImpactScorer, type ImpactScorerInput } from '../services/impact-scorer';
import type { SpaceWeatherData } from './useSpaceWeather';
import type { PlaybackMode } from './usePlayback';
import type { SolarWindSample, FlareEvent, CMEEvent, GeomagneticIndexSample, ImpactAssessment } from '../domain/models';
import type { PropagationResult } from '../services/propagation-estimator';

export interface TimeSlicedData {
  /** Solar wind samples up to current time */
  solarWind: SolarWindSample[];
  /** Latest solar wind at cursor */
  latestSolarWind: SolarWindSample | null;
  /** Flares up to current time */
  flares: FlareEvent[];
  /** CMEs up to current time */
  cmes: CMEEvent[];
  /** Official Kp up to current time */
  officialKp: GeomagneticIndexSample[];
  /** Recomputed magnetosphere at cursor */
  magnetosphere: MagnetosphereResult | null;
  /** Recomputed impacts at cursor */
  impacts: ImpactAssessment | null;
  /** Propagation results (filtered) */
  propagations: PropagationResult[];
  /** Full magnetosphere history for charts */
  magnetosphereHistory: MagnetosphereResult[];
}

const magnetosphereEstimator = new MagnetosphereResponseEstimator();
const impactScorerInstance = new ImpactScorer();

/**
 * Filter array of timestamped items to those <= cutoff.
 * Items must have a field mapping to ISO timestamp.
 */
function filterByTime<T>(items: T[], getTimestamp: (item: T) => string, cutoffMs: number): T[] {
  return items.filter((item) => new Date(getTimestamp(item)).getTime() <= cutoffMs);
}

export function useTimeSlicedData(
  data: SpaceWeatherData,
  mode: PlaybackMode,
  currentTime: string
): TimeSlicedData {
  return useMemo(() => {
    if (!data.timeline) {
      return {
        solarWind: [],
        latestSolarWind: null,
        flares: [],
        cmes: [],
        officialKp: [],
        magnetosphere: null,
        impacts: null,
        propagations: [],
        magnetosphereHistory: [],
      };
    }

    // In live mode, return data as-is
    if (mode === 'live') {
      return {
        solarWind: data.timeline.solarWind,
        latestSolarWind: data.timeline.latestSolarWind,
        flares: data.timeline.flares,
        cmes: data.timeline.cmes,
        officialKp: data.timeline.officialKp,
        magnetosphere: data.magnetosphere,
        impacts: data.impacts,
        propagations: data.propagations,
        magnetosphereHistory: data.magnetosphereHistory,
      };
    }

    // Playback mode — slice to cursor
    const cutoffMs = new Date(currentTime).getTime();

    const solarWind = filterByTime(data.timeline.solarWind, (s) => s.timestamp_utc, cutoffMs);
    const flares = filterByTime(data.timeline.flares, (f) => f.begin_time_utc, cutoffMs);
    const cmes = filterByTime(data.timeline.cmes, (c) => c.start_time_utc, cutoffMs);
    const officialKp = filterByTime(data.timeline.officialKp, (k) => k.timestamp_utc, cutoffMs);
    const magnetosphereHistory = filterByTime(
      data.magnetosphereHistory,
      (m) => m.sample.timestamp_utc,
      cutoffMs
    );

    // Get the solar wind sample closest to cursor
    const latestSolarWind = solarWind.length > 0 ? solarWind[solarWind.length - 1] : null;

    // Recompute magnetosphere at cursor position
    let magnetosphere: MagnetosphereResult | null = null;
    if (latestSolarWind) {
      magnetosphere = magnetosphereEstimator.estimate(latestSolarWind);
    }

    // Recompute impacts at cursor position
    let impacts: ImpactAssessment | null = null;
    if (magnetosphere) {
      const couplingRate = ImpactScorer.computeCouplingRate(
        magnetosphereHistory.map((m) => ({
          timestamp_utc: m.sample.timestamp_utc,
          coupling: m.coupling,
        }))
      );

      const latestFlare = flares.length > 0 ? flares[flares.length - 1] : null;

      const input: ImpactScorerInput = {
        kpEstimate: magnetosphere.kpEstimate,
        latestFlare,
        couplingRateOfChange: couplingRate,
        quality: data.overallQuality,
      };

      impacts = impactScorerInstance.score(input);
    }

    // Filter propagation results
    const propagations = data.propagations.filter((p) => {
      const cme = cmes.find((c) => c.id === p.cmeId);
      return cme != null;
    });

    return {
      solarWind,
      latestSolarWind,
      flares,
      cmes,
      officialKp,
      magnetosphere,
      impacts,
      propagations,
      magnetosphereHistory,
    };
  }, [data, mode, currentTime]);
}
