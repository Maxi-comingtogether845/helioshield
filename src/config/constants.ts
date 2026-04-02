/**
 * GlobalSim Helioshield — Scientific Constants
 *
 * All values in SI-consistent units unless noted.
 * Sources cited inline. Coordinate assumptions documented.
 */

export const SCIENTIFIC_CONSTANTS = {
  /**
   * Sun-Earth distance in km.
   * 1 AU = 1.496 × 10⁸ km (IAU 2012 exact definition: 149_597_870.7 km)
   */
  AU_KM: 149_597_870.7,

  /** Solar radius in km (IAU 2015 nominal) */
  SOLAR_RADIUS_KM: 695_700,

  /** Earth radius in km (mean, IUGG) */
  EARTH_RADIUS_KM: 6_371,

  /** L1 Lagrange point distance from Earth in km (~1.5 million km) */
  L1_DISTANCE_KM: 1_500_000,

  /** Proton mass in kg (CODATA 2018) */
  PROTON_MASS_KG: 1.672_621_923_69e-27,

  /**
   * Drag-Based Model (DBM) drag parameter γ in km⁻¹
   * Typical range: 0.1–2.0 × 10⁻⁷ km⁻¹
   * Reference: Vršnak et al. (2013), Solar Physics, 285, 295–315
   */
  DBM_GAMMA_DEFAULT: 0.2e-7,

  /**
   * Ambient solar wind speed in km/s.
   * Used when no real-time solar wind data is available.
   * Typical slow wind: 300–400 km/s; fast wind: 500–800 km/s
   */
  AMBIENT_SOLAR_WIND_SPEED_KMS: 400,

  /**
   * Geomagnetic dipole tilt angle in degrees (IGRF-13 epoch 2020).
   * Used for simplified geomagnetic ↔ geographic latitude conversion.
   * The dipole axis is ~11.5° from the rotation axis.
   *
   * Coordinate assumption: We use a centered dipole approximation.
   * For v1, geomagnetic latitude ≈ geographic latitude adjusted by
   * the offset of the dipole pole (~80.65°N, 72.68°W in 2020).
   * This is accurate to ±3° for mid-latitudes.
   */
  DIPOLE_TILT_DEG: 11.5,
  DIPOLE_POLE_LAT_DEG: 80.65,
  DIPOLE_POLE_LON_DEG: -72.68,

  /**
   * Kp index bounds.
   * Kp is defined on [0, 9] with 1/3 fractional steps (0, 0+, 1-, 1, ...).
   * Our surrogate model outputs a continuous value clamped to [0, 9].
   */
  KP_MIN: 0,
  KP_MAX: 9,
} as const;

/**
 * Flare class X-ray flux thresholds in W/m² (1–8 Å GOES band).
 * Source: NOAA SWPC Space Weather Scales
 *
 * A: < 1×10⁻⁷
 * B: 1×10⁻⁷ to < 1×10⁻⁶
 * C: 1×10⁻⁶ to < 1×10⁻⁵
 * M: 1×10⁻⁵ to < 1×10⁻⁴
 * X: ≥ 1×10⁻⁴
 */
export const FLARE_THRESHOLDS_WM2 = {
  A_MAX: 1e-7,
  B_MAX: 1e-6,
  C_MAX: 1e-5,
  M_MAX: 1e-4,
} as const;

/**
 * Kp → Storm phase mapping (NOAA G-scale).
 *
 * Kp < 4   : Quiet
 * Kp = 4   : Active
 * Kp = 5   : G1 – Minor Storm
 * Kp = 6   : G2 – Moderate Storm
 * Kp = 7–8 : G3/G4 – Strong/Severe Storm
 * Kp = 9   : G5 – Extreme Storm
 */
export const KP_STORM_THRESHOLDS = {
  ACTIVE: 4,
  MINOR: 5,
  MODERATE: 6,
  STRONG: 7,
  SEVERE: 8,
  EXTREME: 9,
} as const;

/**
 * Aurora equatorward boundary model coefficients.
 * λ_eq ≈ A - B × Kp (geomagnetic latitude in degrees)
 * Reference: Starkov (2008), Geomagnetism and Aeronomy, 48, 5, 580–584
 */
export const AURORA_BOUNDARY = {
  INTERCEPT_DEG: 77,
  SLOPE_DEG_PER_KP: 3.5,
} as const;

/**
 * Newell coupling function empirical coefficients.
 * dΦ_MP/dt = v^α × Bt^β × sin^γ(θ_c/2)
 * Reference: Newell et al. (2007), JGR, 112, A01206
 *
 * Unit note: v in km/s, Bt in nT.
 * Output units: Wb/s (dimensionally, but treated as a coupling proxy)
 */
export const NEWELL_COUPLING = {
  VELOCITY_EXPONENT: 4 / 3,
  BT_EXPONENT: 2 / 3,
  THETA_EXPONENT: 8 / 3,
} as const;

/**
 * DBM integrator settings.
 * Δt = 60s is stable for RK4 with γ ~ 10⁻⁸ and V ~ 300–3000 km/s.
 */
export const DBM_INTEGRATOR = {
  DT_SECONDS: 60,
  MAX_STEPS: 100_000, // ~69 days max propagation
} as const;
