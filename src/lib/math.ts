/**
 * GlobalSim Helioshield — Mathematical Utilities
 *
 * Numerical methods and helper functions.
 * All functions are pure and deterministic for a given input.
 */

/**
 * Clamp a value to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b.
 * t=0 → a, t=1 → b
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Safe power function for fractional exponents.
 *
 * Math.pow(base, exp) returns NaN if base < 0 and exp is non-integer.
 * This guard ensures base ≥ 0 before computing.
 *
 * Used for Newell coupling: sin^(8/3)(θ/2)
 */
export function safePow(base: number, exponent: number): number {
  const safeBase = Math.max(0, base);
  if (safeBase === 0) return 0;
  return Math.pow(safeBase, exponent);
}

/**
 * Classical 4th-order Runge-Kutta integrator (RK4).
 *
 * Integrates dy/dt = f(t, y) from t₀ to t₀+dt.
 *
 * @param f  - derivative function f(t, y) → dy/dt
 * @param t  - current time
 * @param y  - current state
 * @param dt - time step
 * @returns  - new state at t + dt
 *
 * Numerical stability note:
 * For the DBM (dV/dt = -γ(V-Vsw)|V-Vsw|):
 *   γ ~ 2×10⁻⁸, V ~ 300–3000 km/s
 *   Max |f| ~ 2×10⁻⁸ × 2600² ≈ 0.135 km/s²
 *   With dt = 60s, ΔV ~ 8 km/s per step — well within RK4 stability.
 */
export function rk4Step(
  f: (t: number, y: number) => number,
  t: number,
  y: number,
  dt: number
): number {
  const k1 = f(t, y);
  const k2 = f(t + dt / 2, y + (dt / 2) * k1);
  const k3 = f(t + dt / 2, y + (dt / 2) * k2);
  const k4 = f(t + dt, y + dt * k3);
  return y + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

/**
 * Integrate an ODE over multiple steps using RK4.
 *
 * @param f       - derivative function f(t, y)
 * @param t0      - initial time
 * @param y0      - initial state
 * @param dt      - time step
 * @param steps   - number of steps
 * @param stopFn  - optional early stop condition
 * @returns       - array of { t, y } tuples
 */
export function rk4Integrate(
  f: (t: number, y: number) => number,
  t0: number,
  y0: number,
  dt: number,
  steps: number,
  stopFn?: (t: number, y: number) => boolean
): Array<{ t: number; y: number }> {
  const trajectory: Array<{ t: number; y: number }> = [{ t: t0, y: y0 }];

  let t = t0;
  let y = y0;

  for (let i = 0; i < steps; i++) {
    y = rk4Step(f, t, y, dt);
    t += dt;
    trajectory.push({ t, y });

    if (stopFn && stopFn(t, y)) break;
  }

  return trajectory;
}

/**
 * Compute vector magnitude from components.
 * Used for Bt = √(Bx² + By² + Bz²)
 */
export function vectorMagnitude(...components: number[]): number {
  return Math.sqrt(components.reduce((sum, c) => sum + c * c, 0));
}

/**
 * Compute clock angle θ_c = atan2(|By|, Bz) in radians.
 *
 * GSM coordinate convention:
 *   Bz > 0 → northward → θ ≈ 0 → weak coupling
 *   Bz < 0 → southward → θ ≈ π → strong coupling
 *
 * Returns value in [0, π].
 */
export function clockAngle(by: number, bz: number): number {
  return Math.atan2(Math.abs(by), bz);
}
