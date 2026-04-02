/**
 * GlobalSim Helioshield — useSpaceWeather Hook
 *
 * Central data hook: orchestrates ingest → fusion → computation → impacts.
 * Provides the full SpaceWeatherState for all dashboard panels.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { IngestService } from '../services/ingest-service';
import { EventFusionEngine, type FusedTimeline } from '../services/event-fusion-engine';
import { MagnetosphereResponseEstimator, type MagnetosphereResult } from '../services/magnetosphere-response';
import { PropagationEstimator, type PropagationResult } from '../services/propagation-estimator';
import { ImpactScorer, type ImpactScorerInput } from '../services/impact-scorer';
import type { ImpactAssessment } from '../domain/models';
import type { DataQuality } from '../domain/enums';

const REFRESH_INTERVAL_MS = 60_000; // 1 minute

export interface SpaceWeatherData {
  timeline: FusedTimeline | null;
  magnetosphere: MagnetosphereResult | null;
  magnetosphereHistory: MagnetosphereResult[];
  propagations: PropagationResult[];
  impacts: ImpactAssessment | null;
  overallQuality: DataQuality;
  degradedSources: string[];
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SpaceWeatherData = {
  timeline: null,
  magnetosphere: null,
  magnetosphereHistory: [],
  propagations: [],
  impacts: null,
  overallQuality: 'fallback',
  degradedSources: [],
  lastUpdated: null,
  isLoading: true,
  error: null,
};

export function useSpaceWeather(): SpaceWeatherData & { refresh: () => void } {
  const [data, setData] = useState<SpaceWeatherData>(initialState);
  const ingestService = useRef(new IngestService());
  const fusionEngine = useRef(new EventFusionEngine());
  const magnetosphereEstimator = useRef(new MagnetosphereResponseEstimator());
  const propagationEstimator = useRef(new PropagationEstimator());
  const impactScorer = useRef(new ImpactScorer());
  const magnetosphereHistoryRef = useRef<MagnetosphereResult[]>([]);

  const fetchAndCompute = useCallback(async () => {
    try {
      setData((prev) => ({ ...prev, isLoading: true, error: null }));

      // 1. Ingest from all sources
      const ingestResult = await ingestService.current.fetchAll();

      // 2. Fuse into unified timeline
      const timeline = fusionEngine.current.fuse(ingestResult);

      // 3. Compute magnetosphere response from latest solar wind
      let magnetosphere: MagnetosphereResult | null = null;
      if (timeline.latestSolarWind) {
        magnetosphere = magnetosphereEstimator.current.estimate(timeline.latestSolarWind);
        if (magnetosphere) {
          magnetosphereHistoryRef.current = [
            ...magnetosphereHistoryRef.current.slice(-59),
            magnetosphere,
          ];
        }
      }

      // 4. Estimate CME propagation for Earth-directed CMEs
      const ambientSpeed = timeline.latestSolarWind?.speed_km_s ?? undefined;
      const propagations = propagationEstimator.current.estimateAll(
        timeline.cmes,
        ambientSpeed
      );

      // 5. Compute impacts
      let impacts: ImpactAssessment | null = null;
      if (magnetosphere) {
        const couplingRate = ImpactScorer.computeCouplingRate(
          magnetosphereHistoryRef.current.map((m) => ({
            timestamp_utc: m.sample.timestamp_utc,
            coupling: m.coupling,
          }))
        );

        const latestFlare =
          timeline.flares.length > 0
            ? timeline.flares[timeline.flares.length - 1]
            : null;

        const input: ImpactScorerInput = {
          kpEstimate: magnetosphere.kpEstimate,
          latestFlare,
          couplingRateOfChange: couplingRate,
          quality: timeline.overallQuality,
        };

        impacts = impactScorer.current.score(input);
      }

      setData({
        timeline,
        magnetosphere,
        magnetosphereHistory: magnetosphereHistoryRef.current,
        propagations,
        impacts,
        overallQuality: timeline.overallQuality,
        degradedSources: timeline.degradedSources,
        lastUpdated: new Date().toISOString(),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error during data pipeline',
      }));
    }
  }, []);

  useEffect(() => {
    fetchAndCompute();
    const interval = setInterval(fetchAndCompute, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAndCompute]);

  return { ...data, refresh: fetchAndCompute };
}
