/**
 * GlobalSim Helioshield — Impact Scorer
 *
 * Computes downstream impact risk levels from geomagnetic state.
 *
 * Models:
 *   1. Aurora equatorward boundary: λ_eq ≈ 77 - 3.5 × Kp (Starkov, 2008)
 *   2. Satellite drag risk: classify(Kp) — thermospheric expansion proxy
 *   3. HF radio disruption: classify(flare class) — D-region absorption proxy
 *   4. Power grid GIC risk: classify(|dCoupling/dt|) — geomagnetic induction proxy
 *
 * All outputs labeled as simulation_estimate with explainability metadata.
 */

import { AURORA_BOUNDARY, SCIENTIFIC_CONSTANTS } from '../config/constants';
import {
  SATELLITE_DRAG_THRESHOLDS,
  HF_RADIO_THRESHOLDS,
  POWER_GRID_THRESHOLDS,
  AURORA_RISK_THRESHOLDS,
  classifyByThreshold,
} from '../config/thresholds';
import { clamp } from '../lib/math';
import { geomagToGeographic } from '../lib/units';
import type { ImpactAssessment, FlareEvent, SolarWindSample } from '../domain/models';
import type { RiskLevel, DataQuality } from '../domain/enums';

export interface ImpactScorerInput {
  /** Estimated Kp (our model or official) */
  kpEstimate: number;
  /** Latest flare event (for HF radio assessment) */
  latestFlare: FlareEvent | null;
  /** Coupling function rate of change (derived from consecutive samples) */
  couplingRateOfChange: number;
  /** Solar wind data quality */
  quality: DataQuality;
}

/**
 * Compute aurora equatorward boundary in geographic latitude.
 *
 * Model: λ_geomag = 77° - 3.5 × Kp (Starkov, 2008)
 * Then convert geomagnetic → geographic latitude (centered dipole approx).
 *
 * @param kp - Kp index (0–9)
 * @returns geographic latitude in degrees, clamped to [0, 90]
 */
export function auroraEquatorwardBoundary(kp: number): number {
  const geomagLat =
    AURORA_BOUNDARY.INTERCEPT_DEG - AURORA_BOUNDARY.SLOPE_DEG_PER_KP * kp;

  // Convert geomagnetic → geographic latitude
  const geoLat = geomagToGeographic(geomagLat);

  return clamp(geoLat, 0, 90);
}

/**
 * Classify aurora risk by equatorward boundary latitude.
 */
export function classifyAuroraRisk(boundaryLatDeg: number): RiskLevel {
  return classifyByThreshold(boundaryLatDeg, AURORA_RISK_THRESHOLDS);
}

/**
 * Classify satellite drag risk by Kp.
 */
export function classifySatelliteDragRisk(kp: number): RiskLevel {
  return classifyByThreshold(kp, SATELLITE_DRAG_THRESHOLDS);
}

/**
 * Classify HF radio disruption by flare class.
 */
export function classifyHFRadioRisk(flare: FlareEvent | null): RiskLevel {
  if (!flare) return 'none';
  return (HF_RADIO_THRESHOLDS[flare.flare_class] as RiskLevel) ?? 'none';
}

/**
 * Classify power grid GIC risk by coupling rate of change.
 */
export function classifyPowerGridRisk(couplingRate: number): RiskLevel {
  return classifyByThreshold(Math.abs(couplingRate), POWER_GRID_THRESHOLDS);
}

export class ImpactScorer {
  /**
   * Compute full impact assessment.
   */
  score(input: ImpactScorerInput): ImpactAssessment {
    const auroraBoundary = auroraEquatorwardBoundary(input.kpEstimate);
    const auroraRisk = classifyAuroraRisk(auroraBoundary);
    const satRisk = classifySatelliteDragRisk(input.kpEstimate);
    const hfRisk = classifyHFRadioRisk(input.latestFlare);
    const gridRisk = classifyPowerGridRisk(input.couplingRateOfChange);

    const explanations: Record<string, string> = {};

    // Aurora explanation
    explanations.aurora =
      `Kp=${input.kpEstimate.toFixed(1)} → equatorward boundary ≈ ${auroraBoundary.toFixed(1)}° geographic lat. ` +
      `Risk: ${auroraRisk}. ` +
      (auroraRisk !== 'none'
        ? `Aurora potentially visible at latitudes above ${auroraBoundary.toFixed(0)}°.`
        : 'Aurora confined to polar regions.');

    // Satellite drag
    explanations.satellite_drag =
      `Kp=${input.kpEstimate.toFixed(1)} → thermospheric heating ${satRisk === 'none' ? 'minimal' : 'elevated'}. ` +
      `Risk: ${satRisk}. ` +
      (satRisk !== 'none'
        ? 'LEO satellites may experience increased atmospheric drag.'
        : 'Normal drag conditions.');

    // HF radio
    if (input.latestFlare) {
      explanations.hf_radio =
        `Active ${input.latestFlare.flare_class}-class flare → ` +
        `D-region ionization ${hfRisk === 'none' ? 'minimal' : 'significant'}. ` +
        `Risk: ${hfRisk}. ` +
        (hfRisk !== 'none'
          ? 'HF radio communication may be disrupted on the sunlit hemisphere.'
          : 'Normal HF propagation.');
    } else {
      explanations.hf_radio = 'No active flare — HF radio conditions normal. Risk: none.';
    }

    // Power grid
    explanations.power_grid =
      `Coupling rate = ${Math.abs(input.couplingRateOfChange).toFixed(0)} units/min. ` +
      `Risk: ${gridRisk}. ` +
      (gridRisk !== 'none'
        ? 'Rapid geomagnetic variations may induce currents in power grids.'
        : 'GIC risk minimal.');

    return {
      timestamp_utc: new Date().toISOString(),
      aurora_boundary_lat_deg: Math.round(auroraBoundary * 10) / 10,
      aurora_risk: auroraRisk,
      satellite_drag_risk: satRisk,
      hf_radio_risk: hfRisk,
      power_grid_risk: gridRisk,
      explanations,
      origin: 'simulation_estimate',
      quality: input.quality,
    };
  }

  /**
   * Compute coupling rate of change from consecutive magnetosphere results.
   *
   * @param couplingValues - array of { timestamp_utc, coupling } pairs
   * @returns rate in coupling-units per minute
   */
  static computeCouplingRate(
    couplingValues: Array<{ timestamp_utc: string; coupling: number }>
  ): number {
    if (couplingValues.length < 2) return 0;

    const last = couplingValues[couplingValues.length - 1];
    const prev = couplingValues[couplingValues.length - 2];

    const dtMs =
      new Date(last.timestamp_utc).getTime() - new Date(prev.timestamp_utc).getTime();
    if (dtMs <= 0) return 0;

    const dtMinutes = dtMs / 60_000;
    return (last.coupling - prev.coupling) / dtMinutes;
  }
}
