/**
 * GlobalSim Helioshield — Alert Thresholds
 *
 * Classification boundaries for impact scoring.
 * All derived from NOAA Space Weather Scales and published literature.
 */

import type { RiskLevel } from '../domain/enums';

interface ThresholdBand {
  readonly min: number;
  readonly max: number;
  readonly level: RiskLevel;
}

/**
 * Satellite drag risk classification based on Kp index.
 *
 * At higher Kp, thermospheric heating increases atmospheric density
 * at LEO altitudes, causing accelerated orbital decay.
 *
 * Reference: Emmert et al. (2010), JGR, 115
 */
export const SATELLITE_DRAG_THRESHOLDS: readonly ThresholdBand[] = [
  { min: 0, max: 3, level: 'none' },
  { min: 3, max: 5, level: 'low' },
  { min: 5, max: 7, level: 'moderate' },
  { min: 7, max: 8, level: 'high' },
  { min: 8, max: 10, level: 'severe' },
] as const;

/**
 * HF radio disruption based on GOES X-ray flare class.
 *
 * Solar X-ray flux ionizes the D-region of the ionosphere,
 * causing shortwave fadeouts (SWF) on the sunlit hemisphere.
 *
 * Reference: NOAA Space Weather Scales — Radio Blackout (R1–R5)
 */
export const HF_RADIO_THRESHOLDS: {
  readonly [K in string]: RiskLevel;
} = {
  A: 'none',
  B: 'none',
  C: 'low',
  M: 'moderate',
  X: 'severe',
} as const;

/**
 * Power grid (GIC) risk based on rate of change of geomagnetic coupling.
 *
 * Geomagnetically Induced Currents (GIC) correlate with |dB/dt|
 * at the ground, which we approximate via the rate of change
 * of the Newell coupling function.
 *
 * Units: coupling_rate is in (coupling units)/minute
 *
 * Reference: Pulkkinen et al. (2017), Space Weather, 15
 */
export const POWER_GRID_THRESHOLDS: readonly ThresholdBand[] = [
  { min: 0, max: 500, level: 'none' },
  { min: 500, max: 2000, level: 'low' },
  { min: 2000, max: 5000, level: 'moderate' },
  { min: 5000, max: 10000, level: 'high' },
  { min: 10000, max: Infinity, level: 'severe' },
] as const;

/**
 * Aurora visibility risk based on equatorward boundary latitude.
 *
 * Lower boundary latitude = aurora visible at lower latitudes = higher "risk"
 * (or rather, higher visibility / more significant storm).
 */
export const AURORA_RISK_THRESHOLDS: readonly ThresholdBand[] = [
  { min: 65, max: 90, level: 'none' },     // Only polar
  { min: 55, max: 65, level: 'low' },       // High latitudes (Scandinavia, Canada)
  { min: 45, max: 55, level: 'moderate' },  // Mid-high (UK, N. US)
  { min: 35, max: 45, level: 'high' },      // Mid-latitude (S. Europe, S. US)
  { min: 0, max: 35, level: 'severe' },     // Extreme — visible from tropics
] as const;

/**
 * Look up a risk level from a threshold band array.
 * Returns 'none' if value is outside all bands.
 */
export function classifyByThreshold(
  value: number,
  thresholds: readonly ThresholdBand[]
): RiskLevel {
  for (const band of thresholds) {
    if (value >= band.min && value < band.max) {
      return band.level;
    }
  }
  return 'none';
}
