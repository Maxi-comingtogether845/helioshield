/**
 * GlobalSim Helioshield — Domain Enumerations
 *
 * Canonical enums for space weather classification.
 * All thresholds derived from NOAA SWPC standards.
 */

/** GOES X-ray flare classification (peak flux in 1–8 Å band) */
export const FlareClass = {
  A: 'A',
  B: 'B',
  C: 'C',
  M: 'M',
  X: 'X',
} as const;
export type FlareClass = (typeof FlareClass)[keyof typeof FlareClass];

/** Geomagnetic storm phase based on Kp index */
export const StormPhase = {
  Quiet: 'quiet',
  Active: 'active',
  MinorStorm: 'minor_storm',
  ModerateStorm: 'moderate_storm',
  StrongStorm: 'strong_storm',
  SevereStorm: 'severe_storm',
  ExtremeStorm: 'extreme_storm',
} as const;
export type StormPhase = (typeof StormPhase)[keyof typeof StormPhase];

/** Impact risk level for downstream effects */
export const RiskLevel = {
  None: 'none',
  Low: 'low',
  Moderate: 'moderate',
  High: 'high',
  Severe: 'severe',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

/**
 * Data quality flag — tracks how "fresh" or "reliable" a data point is.
 *
 * fresh:        received within expected cadence, validated
 * delayed:      received but older than expected cadence
 * sparse:       some fields missing but core fields present
 * interpolated: gap-filled via linear interpolation from neighbors
 * fallback:     using cached/static data because source failed
 */
export const DataQuality = {
  Fresh: 'fresh',
  Delayed: 'delayed',
  Sparse: 'sparse',
  Interpolated: 'interpolated',
  Fallback: 'fallback',
} as const;
export type DataQuality = (typeof DataQuality)[keyof typeof DataQuality];

/** Distinguishes simulation estimates from official reference data */
export const DataOrigin = {
  SimulationEstimate: 'simulation_estimate',
  OfficialReference: 'official_reference',
} as const;
export type DataOrigin = (typeof DataOrigin)[keyof typeof DataOrigin];

/** CME type classification from DONKI */
export const CMEType = {
  S: 'S',   // Slow
  C: 'C',   // Common
  O: 'O',   // Occasional
  R: 'R',   // Rare
  ER: 'ER', // Extremely Rare
} as const;
export type CMEType = (typeof CMEType)[keyof typeof CMEType];
