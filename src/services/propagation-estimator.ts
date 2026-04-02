/**
 * GlobalSim Helioshield — Propagation Estimator
 *
 * Implements the Drag-Based Model (DBM) for CME Sun-to-Earth transit time.
 *
 * Model: dV/dt = -γ(V - V_sw)|V - V_sw|
 *
 * Reference: Vršnak et al. (2013), Solar Physics, 285, 295–315
 *
 * Physical interpretation:
 *   - CME decelerates (or accelerates) toward ambient solar wind speed
 *   - Drag coefficient γ controls how quickly CME merges with ambient flow
 *   - Model has no singularities: at V = V_sw, dV/dt = 0 (stable equilibrium)
 *
 * Numerical method: RK4 with Δt = 60s
 *
 * Coordinate assumptions:
 *   - Heliocentric radial propagation (1D along Sun-Earth line)
 *   - Distance in km from Sun center
 *   - Start distance: ~10 solar radii (coronagraph field of view edge)
 *
 * Limitations:
 *   - 1D radial only — no lateral deflection
 *   - Constant γ (in reality, γ decreases with distance)
 *   - Constant ambient solar wind (should vary with heliospheric distance)
 *   - No CME-CME interaction
 */

import { SCIENTIFIC_CONSTANTS, DBM_INTEGRATOR } from '../config/constants';
import { rk4Step } from '../lib/math';
import { secondsToHours } from '../lib/units';
import type { CMEEvent } from '../domain/models';

export interface PropagationResult {
  /** CME event ID */
  cmeId: string;
  /** Launch speed at Sun in km/s */
  launchSpeedKmS: number;
  /** Estimated arrival speed at Earth in km/s */
  arrivalSpeedKmS: number;
  /** Transit time in hours */
  transitTimeHours: number;
  /** Estimated arrival time (ISO 8601 UTC) */
  estimatedArrivalUtc: string;
  /** Model confidence: 0–1 */
  confidence: number;
  /** Human-readable explanation **/
  explanation: string;
}

/**
 * DBM derivative function.
 *
 * dV/dt = -γ(V - V_sw)|V - V_sw|
 *
 * @param gamma  - drag coefficient (km⁻¹)
 * @param vSw    - ambient solar wind speed (km/s)
 * @returns derivative function f(t, V)
 */
function dbmDerivative(
  gamma: number,
  vSw: number
): (t: number, v: number) => number {
  return (_t: number, v: number) => {
    const dv = v - vSw;
    return -gamma * dv * Math.abs(dv);
  };
}

export class PropagationEstimator {
  private readonly gamma: number;
  private readonly dt: number;
  private readonly maxSteps: number;
  private readonly earthDistanceKm: number;
  private readonly startDistanceKm: number;

  constructor(
    gamma: number = SCIENTIFIC_CONSTANTS.DBM_GAMMA_DEFAULT,
    ambientSpeedKmS: number = SCIENTIFIC_CONSTANTS.AMBIENT_SOLAR_WIND_SPEED_KMS
  ) {
    this.gamma = gamma;
    this.dt = DBM_INTEGRATOR.DT_SECONDS;
    this.maxSteps = DBM_INTEGRATOR.MAX_STEPS;
    this.earthDistanceKm = SCIENTIFIC_CONSTANTS.AU_KM;
    // Start at ~20 solar radii (typical coronagraph outer edge)
    this.startDistanceKm = 20 * SCIENTIFIC_CONSTANTS.SOLAR_RADIUS_KM;
  }

  /**
   * Estimate CME arrival time and speed at Earth.
   *
   * @param cme - CME event with speed and start time
   * @param ambientSpeed - override ambient solar wind speed (from live data if available)
   */
  estimate(
    cme: CMEEvent,
    ambientSpeed?: number
  ): PropagationResult | null {
    if (!cme.speed_km_s || cme.speed_km_s <= 0) {
      return null; // Cannot estimate without launch speed
    }

    const vSw = ambientSpeed ?? SCIENTIFIC_CONSTANTS.AMBIENT_SOLAR_WIND_SPEED_KMS;
    const v0 = cme.speed_km_s;
    const f = dbmDerivative(this.gamma, vSw);

    // Integrate velocity over time to track position
    let v = v0;
    let r = this.startDistanceKm;
    let t = 0;

    for (let step = 0; step < this.maxSteps; step++) {
      v = rk4Step(f, t, v, this.dt);
      // Position update: dr = v × dt (simple Euler for position — velocity is RK4)
      r += v * this.dt;
      t += this.dt;

      // Sanity guard: velocity should stay positive
      if (v <= 0) v = vSw * 0.5;

      if (r >= this.earthDistanceKm) {
        const transitHours = secondsToHours(t);
        const launchTime = new Date(cme.start_time_utc).getTime();
        const arrivalTime = new Date(launchTime + t * 1000);

        // Confidence heuristic:
        // - Higher for faster CMEs (they're more predictable)
        // - Lower for very slow CMEs (may not reach Earth)
        // - Adjusted by whether CME is Earth-directed
        let confidence = 0.5;
        if (cme.is_earth_directed) confidence += 0.2;
        if (v0 > 1000) confidence += 0.1;
        if (v0 > 500) confidence += 0.1;
        confidence = Math.min(confidence, 0.9);

        const explanation =
          `DBM propagation: V₀=${v0} km/s, V_sw=${vSw} km/s, ` +
          `γ=${this.gamma.toExponential(1)} km⁻¹. ` +
          `Transit ${transitHours.toFixed(1)}h, arrival speed ${v.toFixed(0)} km/s. ` +
          `Earth-directed: ${cme.is_earth_directed ? 'yes' : 'no'}. ` +
          `[Simulation estimate — not an official forecast]`;

        return {
          cmeId: cme.id,
          launchSpeedKmS: v0,
          arrivalSpeedKmS: Math.round(v),
          transitTimeHours: Math.round(transitHours * 10) / 10,
          estimatedArrivalUtc: arrivalTime.toISOString(),
          confidence,
          explanation,
        };
      }
    }

    // CME didn't reach Earth within max integration time
    return null;
  }

  /**
   * Estimate all Earth-directed CMEs from a list.
   */
  estimateAll(
    cmes: CMEEvent[],
    ambientSpeed?: number
  ): PropagationResult[] {
    return cmes
      .filter((cme) => cme.is_earth_directed && cme.speed_km_s != null)
      .map((cme) => this.estimate(cme, ambientSpeed))
      .filter((r): r is PropagationResult => r !== null);
  }
}
