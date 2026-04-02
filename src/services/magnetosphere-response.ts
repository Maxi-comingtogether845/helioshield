/**
 * GlobalSim Helioshield — Magnetosphere Response Estimator
 *
 * Computes geomagnetic coupling and Kp surrogate from solar wind parameters.
 *
 * Model: Newell coupling function (Newell et al., 2007)
 *   dΦ_MP/dt = v^(4/3) × Bt_perp^(2/3) × sin^(8/3)(θ_c/2)
 *
 * Where:
 *   v      = solar wind speed (km/s)
 *   Bt_perp = √(By² + Bz²) — perpendicular IMF component (nT)
 *   θ_c    = clock angle = atan2(|By|, Bz) in GSM
 *
 * Physical interpretation:
 *   - Coupling is maximized when IMF is southward (Bz < 0)
 *   - Fast solar wind drives more energy into the magnetosphere
 *   - The sin^(8/3) term creates a sharp threshold effect at Bz≈0
 *
 * Kp surrogate:
 *   Log-linear mapping from coupling function to Kp ∈ [0, 9].
 *   Calibrated against historical NOAA Kp data (Thomsen 2004 approach).
 *
 * Floating-point guards:
 *   - sin^(8/3): base clamped ≥ 0 before fractional exponent
 *   - Bt_perp: computed from √(By² + Bz²), always ≥ 0
 *   - Log: guarded against ≤ 0 with floor value
 *
 * All outputs labeled as simulation_estimate.
 */

import { SCIENTIFIC_CONSTANTS, NEWELL_COUPLING, KP_STORM_THRESHOLDS } from '../config/constants';
import { clamp, safePow, clockAngle, vectorMagnitude } from '../lib/math';
import type { SolarWindSample, GeomagneticIndexSample } from '../domain/models';
import type { StormPhase, DataQuality } from '../domain/enums';

/**
 * Kp surrogate calibration coefficients.
 *
 * Mapping: Kp = a + b × log₁₀(coupling)
 *
 * Calibrated empirically against historical NOAA Kp data:
 *   - At coupling ≈ 100 → Kp ≈ 1 (quiet)
 *   - At coupling ≈ 5000 → Kp ≈ 5 (minor storm)
 *   - At coupling ≈ 50000 → Kp ≈ 8 (severe storm)
 *
 * Linear fit in log space: Kp ≈ -3.5 + 2.6 × log₁₀(coupling)
 */
const KP_CALIBRATION = {
  intercept: -3.5,
  slope: 2.6,
  minCoupling: 10, // Floor to avoid log(0)
} as const;

/**
 * Compute the Newell coupling function value.
 *
 * @param speedKmS - solar wind speed (km/s)
 * @param byNT     - IMF By component in GSM (nT)
 * @param bzNT     - IMF Bz component in GSM (nT)
 * @returns coupling function value (dimensionless proxy, higher = stronger)
 */
export function computeNewellCoupling(
  speedKmS: number,
  byNT: number,
  bzNT: number
): number {
  if (speedKmS <= 0) return 0;

  const btPerp = vectorMagnitude(byNT, bzNT);
  if (btPerp <= 0) return 0;

  const theta = clockAngle(byNT, bzNT);
  const sinHalfTheta = Math.sin(theta / 2);

  // Apply Newell coupling: v^(4/3) × Bt^(2/3) × sin^(8/3)(θ/2)
  const vTerm = safePow(speedKmS, NEWELL_COUPLING.VELOCITY_EXPONENT);
  const bTerm = safePow(btPerp, NEWELL_COUPLING.BT_EXPONENT);
  const thetaTerm = safePow(sinHalfTheta, NEWELL_COUPLING.THETA_EXPONENT);

  return vTerm * bTerm * thetaTerm;
}

/**
 * Map Newell coupling value to Kp estimate.
 *
 * @param coupling - Newell coupling function output
 * @returns Kp estimate clamped to [0, 9]
 */
export function couplingToKp(coupling: number): number {
  if (coupling <= KP_CALIBRATION.minCoupling) return 0;

  const logCoupling = Math.log10(coupling);
  const kp = KP_CALIBRATION.intercept + KP_CALIBRATION.slope * logCoupling;

  return clamp(kp, SCIENTIFIC_CONSTANTS.KP_MIN, SCIENTIFIC_CONSTANTS.KP_MAX);
}

/**
 * Classify storm phase from Kp value.
 */
export function classifyStormPhase(kp: number): StormPhase {
  if (kp >= KP_STORM_THRESHOLDS.EXTREME) return 'extreme_storm';
  if (kp >= KP_STORM_THRESHOLDS.SEVERE) return 'severe_storm';
  if (kp >= KP_STORM_THRESHOLDS.STRONG) return 'strong_storm';
  if (kp >= KP_STORM_THRESHOLDS.MODERATE) return 'moderate_storm';
  if (kp >= KP_STORM_THRESHOLDS.MINOR) return 'minor_storm';
  if (kp >= KP_STORM_THRESHOLDS.ACTIVE) return 'active';
  return 'quiet';
}

export interface MagnetosphereResult {
  /** Newell coupling function value */
  coupling: number;
  /** Estimated Kp index (0-9) */
  kpEstimate: number;
  /** Storm phase classification */
  stormPhase: StormPhase;
  /** Geomagnetic sample for the state */
  sample: GeomagneticIndexSample;
  /** Human-readable explanation */
  explanation: string;
}

export class MagnetosphereResponseEstimator {
  /**
   * Estimate geomagnetic response from solar wind data.
   *
   * @param sw - Latest solar wind sample
   * @returns MagnetosphereResult or null if data is insufficient
   */
  estimate(sw: SolarWindSample): MagnetosphereResult | null {
    const speed = sw.speed_km_s;
    const by = sw.by_nT;
    const bz = sw.bz_nT;

    if (speed == null || by == null || bz == null) {
      return null; // Insufficient data
    }

    const coupling = computeNewellCoupling(speed, by, bz);
    const kpEstimate = couplingToKp(coupling);
    const stormPhase = classifyStormPhase(kpEstimate);

    const quality: DataQuality = sw.quality;

    const sample: GeomagneticIndexSample = {
      timestamp_utc: sw.timestamp_utc,
      kp: Math.round(kpEstimate * 10) / 10,
      storm_phase: stormPhase,
      origin: 'simulation_estimate',
      quality,
      source: 'Helioshield Newell Coupling Model',
    };

    const bzDir = bz < 0 ? 'southward' : 'northward';
    const explanation =
      `Newell coupling: Vsw=${speed} km/s, By=${by.toFixed(1)} nT, ` +
      `Bz=${bz.toFixed(1)} nT (${bzDir}). ` +
      `Coupling=${coupling.toFixed(0)}, Kp_est=${kpEstimate.toFixed(1)} → ${stormPhase}. ` +
      `[Simulation estimate — not an official forecast]`;

    return {
      coupling,
      kpEstimate,
      stormPhase,
      sample,
      explanation,
    };
  }

  /**
   * Estimate Kp for a time series of solar wind samples.
   * Returns one estimate per sample.
   */
  estimateTimeSeries(samples: SolarWindSample[]): MagnetosphereResult[] {
    return samples
      .map((sw) => this.estimate(sw))
      .filter((r): r is MagnetosphereResult => r !== null);
  }
}
