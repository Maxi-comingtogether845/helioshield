/**
 * GlobalSim Helioshield — Domain Models
 *
 * Zod-validated schemas for all data flowing through the pipeline.
 * Every model includes:
 *   - timestamp_utc: ISO 8601 string, always UTC
 *   - quality: DataQuality flag
 *   - source: human-readable data source identifier
 *
 * Coordinate system assumptions:
 *   - Solar wind magnetic field: GSM (Geocentric Solar Magnetospheric) coordinates
 *   - Bx: sunward, By: duskward, Bz: northward
 *   - Positions: Heliocentric inertial (for Sun-Earth-L1)
 *
 * Unit conventions:
 *   - Speed: km/s
 *   - Magnetic field: nT
 *   - Density: particles/cm³ (p/cc)
 *   - X-ray flux: W/m²
 *   - Temperature: Kelvin
 *   - Distance: km (internal), AU (display)
 *   - Latitude/Longitude: degrees
 *   - Time: ISO 8601 UTC strings
 */

import { z } from 'zod';

// ─── Shared Schemas ───────────────────────────────────────────────────────────

const DataQualitySchema = z.enum([
  'fresh',
  'delayed',
  'sparse',
  'interpolated',
  'fallback',
]);

const DataOriginSchema = z.enum([
  'simulation_estimate',
  'official_reference',
]);

const RiskLevelSchema = z.enum(['none', 'low', 'moderate', 'high', 'severe']);

const StormPhaseSchema = z.enum([
  'quiet',
  'active',
  'minor_storm',
  'moderate_storm',
  'strong_storm',
  'severe_storm',
  'extreme_storm',
]);

const FlareClassSchema = z.enum(['A', 'B', 'C', 'M', 'X']);

// ─── Solar Wind Sample ────────────────────────────────────────────────────────

/**
 * A single solar wind measurement from L1 (DSCOVR/ACE).
 *
 * Contains both plasma (density, speed, temperature) and
 * magnetic field (Bx, By, Bz, Bt) data merged by timestamp.
 */
export const SolarWindSampleSchema = z.object({
  timestamp_utc: z.string().datetime(),
  /** Proton density in particles/cm³ */
  density_p_cc: z.number().nonnegative().nullable(),
  /** Bulk solar wind speed in km/s */
  speed_km_s: z.number().nonnegative().nullable(),
  /** Proton temperature in Kelvin */
  temperature_k: z.number().nonnegative().nullable(),
  /** IMF Bx component (GSM) in nT — sunward */
  bx_nT: z.number().nullable(),
  /** IMF By component (GSM) in nT — duskward */
  by_nT: z.number().nullable(),
  /** IMF Bz component (GSM) in nT — northward (negative = southward) */
  bz_nT: z.number().nullable(),
  /** Total IMF magnitude in nT: Bt = √(Bx² + By² + Bz²) */
  bt_nT: z.number().nonnegative().nullable(),
  quality: DataQualitySchema,
  source: z.string(),
});
export type SolarWindSample = z.infer<typeof SolarWindSampleSchema>;

// ─── Flare Event ──────────────────────────────────────────────────────────────

/**
 * A detected solar flare event.
 *
 * Can come from GOES X-ray flux threshold crossing or NASA DONKI.
 */
export const FlareEventSchema = z.object({
  id: z.string(),
  begin_time_utc: z.string().datetime(),
  peak_time_utc: z.string().datetime().nullable(),
  end_time_utc: z.string().datetime().nullable(),
  flare_class: FlareClassSchema,
  /** Sub-class magnitude, e.g. 2.3 for M2.3 */
  class_magnitude: z.number().positive().nullable(),
  /** Peak X-ray flux in W/m² (1–8 Å) */
  peak_flux_wm2: z.number().positive().nullable(),
  /** Heliographic latitude of the active region (degrees) */
  source_lat_deg: z.number().min(-90).max(90).nullable(),
  /** Heliographic longitude of the active region (degrees) */
  source_lon_deg: z.number().min(-180).max(180).nullable(),
  /** Active region NOAA number */
  active_region: z.number().int().positive().nullable(),
  quality: DataQualitySchema,
  source: z.string(),
});
export type FlareEvent = z.infer<typeof FlareEventSchema>;

// ─── CME Event ────────────────────────────────────────────────────────────────

/**
 * A Coronal Mass Ejection event from NASA DONKI.
 */
export const CMEEventSchema = z.object({
  id: z.string(),
  /** CME first appearance in coronagraph */
  start_time_utc: z.string().datetime(),
  /** Linear speed from DONKI CME analysis in km/s */
  speed_km_s: z.number().positive().nullable(),
  /** Half-angular width in degrees */
  half_angle_deg: z.number().nonnegative().nullable(),
  /** Whether Earth is within the CME cone (halo/partial halo) */
  is_earth_directed: z.boolean(),
  /** Estimated arrival time (from DONKI analysis or our DBM) */
  estimated_arrival_utc: z.string().datetime().nullable(),
  /** Estimated arrival speed at Earth in km/s */
  estimated_arrival_speed_km_s: z.number().positive().nullable(),
  /** Confidence in arrival estimate: 0–1 */
  arrival_confidence: z.number().min(0).max(1),
  /** Associated flare event IDs */
  associated_flare_ids: z.array(z.string()),
  quality: DataQualitySchema,
  source: z.string(),
});
export type CMEEvent = z.infer<typeof CMEEventSchema>;

// ─── Geomagnetic Index Sample ─────────────────────────────────────────────────

/**
 * A Kp/Ap geomagnetic index observation.
 *
 * Official values come from NOAA SWPC (3-hour cadence).
 * Our surrogate model also produces these with DataOrigin = 'simulation_estimate'.
 */
export const GeomagneticIndexSampleSchema = z.object({
  timestamp_utc: z.string().datetime(),
  /** Planetary Kp index: 0–9 (continuous for our model, integer for official) */
  kp: z.number().min(0).max(9),
  /** Storm phase classification */
  storm_phase: StormPhaseSchema,
  origin: DataOriginSchema,
  quality: DataQualitySchema,
  source: z.string(),
});
export type GeomagneticIndexSample = z.infer<typeof GeomagneticIndexSampleSchema>;

// ─── Impact Assessment ────────────────────────────────────────────────────────

/**
 * Downstream impact scoring for a given time step.
 * Every score includes an `explanation` array listing which
 * input variables drove the risk level and in what direction.
 */
export const ImpactAssessmentSchema = z.object({
  timestamp_utc: z.string().datetime(),

  /** Aurora equatorward boundary in geographic latitude (degrees) */
  aurora_boundary_lat_deg: z.number().min(0).max(90),
  aurora_risk: RiskLevelSchema,

  /** Satellite drag risk proxy */
  satellite_drag_risk: RiskLevelSchema,

  /** HF radio disruption proxy */
  hf_radio_risk: RiskLevelSchema,

  /** Power grid / GIC disturbance proxy */
  power_grid_risk: RiskLevelSchema,

  /** Human-readable explanation for each risk factor */
  explanations: z.record(z.string(), z.string()),

  origin: DataOriginSchema,
  quality: DataQualitySchema,
});
export type ImpactAssessment = z.infer<typeof ImpactAssessmentSchema>;

// ─── Space Weather State (fused) ──────────────────────────────────────────────

/**
 * The top-level fused state at a given timepoint.
 * Combines all data layers into a single snapshot for UI consumption.
 */
export const SpaceWeatherStateSchema = z.object({
  timestamp_utc: z.string().datetime(),

  /** Latest solar wind data (may be null if source failed) */
  solar_wind: SolarWindSampleSchema.nullable(),

  /** Recent flare events (last 24h) */
  recent_flares: z.array(FlareEventSchema),

  /** Active/recent CME events */
  active_cmes: z.array(CMEEventSchema),

  /** Simulated Kp estimate */
  kp_estimate: GeomagneticIndexSampleSchema.nullable(),

  /** Official NOAA Kp reference (separate overlay) */
  kp_official: GeomagneticIndexSampleSchema.nullable(),

  /** Impact assessment */
  impacts: ImpactAssessmentSchema.nullable(),

  /** Overall system data quality — worst of all components */
  overall_quality: DataQualitySchema,

  /** Which data sources are currently degraded */
  degraded_sources: z.array(z.string()),
});
export type SpaceWeatherState = z.infer<typeof SpaceWeatherStateSchema>;
