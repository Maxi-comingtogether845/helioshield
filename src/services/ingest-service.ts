/**
 * GlobalSim Helioshield — Ingest Service
 *
 * Orchestrates parallel data fetching from all adapters.
 * Handles partial failures with panel-level degraded mode.
 *
 * Design:
 *   - All adapters are fetched concurrently via Promise.allSettled
 *   - Each source can fail independently without blocking others
 *   - Failed sources are reported in `degraded_sources`
 *   - Overall quality is the worst quality across all sources
 */

import { NoaaSolarWindAdapter } from './adapters/noaa-solar-wind';
import { NoaaKpIndexAdapter } from './adapters/noaa-kp-index';
import { GoesXrayAdapter } from './adapters/goes-xray';
import { NasaDonkiAdapter } from './adapters/nasa-donki';
import type { SolarWindSample, FlareEvent, CMEEvent, GeomagneticIndexSample } from '../domain/models';
import type { DataQuality } from '../domain/enums';
import type { AdapterResult } from './adapters/types';

export interface IngestResult {
  solarWind: AdapterResult<SolarWindSample>;
  officialKp: AdapterResult<GeomagneticIndexSample>;
  xrayFlares: AdapterResult<FlareEvent>;
  donkiCMEs: AdapterResult<CMEEvent>;
  donkiFlares: AdapterResult<FlareEvent>;
  degradedSources: string[];
  overallQuality: DataQuality;
  timestamp: string;
}

const QUALITY_PRIORITY: DataQuality[] = [
  'fresh',
  'delayed',
  'sparse',
  'interpolated',
  'fallback',
];

function worstQuality(...qualities: DataQuality[]): DataQuality {
  let worstIdx = 0;
  for (const q of qualities) {
    const idx = QUALITY_PRIORITY.indexOf(q);
    if (idx > worstIdx) worstIdx = idx;
  }
  return QUALITY_PRIORITY[worstIdx];
}

export class IngestService {
  private readonly solarWindAdapter = new NoaaSolarWindAdapter();
  private readonly kpAdapter = new NoaaKpIndexAdapter();
  private readonly xrayAdapter = new GoesXrayAdapter();
  private readonly donkiAdapter = new NasaDonkiAdapter();

  /**
   * Fetch all data sources in parallel.
   * Never throws — all failures are captured per-source.
   */
  async fetchAll(): Promise<IngestResult> {
    const [swResult, kpResult, xrayResult, cmeResult, flrResult] =
      await Promise.all([
        this.solarWindAdapter.fetch(),
        this.kpAdapter.fetch(),
        this.xrayAdapter.fetch(),
        this.donkiAdapter.fetchCMEs(30),
        this.donkiAdapter.fetchFlares(7),
      ]);

    const degradedSources: string[] = [];
    const qualities: DataQuality[] = [];

    for (const result of [swResult, kpResult, xrayResult, cmeResult, flrResult]) {
      qualities.push(result.quality);
      if (result.error || result.quality === 'fallback') {
        degradedSources.push(result.source);
      }
    }

    return {
      solarWind: swResult,
      officialKp: kpResult,
      xrayFlares: xrayResult,
      donkiCMEs: cmeResult,
      donkiFlares: flrResult,
      degradedSources,
      overallQuality: worstQuality(...qualities),
      timestamp: new Date().toISOString(),
    };
  }
}
