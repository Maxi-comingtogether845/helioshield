/**
 * GlobalSim Helioshield — Domain Model Tests
 *
 * Validates Zod schemas against mock fixtures and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  SolarWindSampleSchema,
  FlareEventSchema,
  CMEEventSchema,
  GeomagneticIndexSampleSchema,
  ImpactAssessmentSchema,
} from '../../domain/models';

describe('SolarWindSampleSchema', () => {
  it('parses a valid sample with all fields', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: 5.2,
      speed_km_s: 350,
      temperature_k: 80000,
      bx_nT: -2.1,
      by_nT: 1.5,
      bz_nT: 2.0,
      bt_nT: 3.3,
      quality: 'fresh',
      source: 'test',
    };
    const result = SolarWindSampleSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it('accepts null for optional numeric fields (sparse data)', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: null,
      speed_km_s: 350,
      temperature_k: null,
      bx_nT: null,
      by_nT: null,
      bz_nT: null,
      bt_nT: null,
      quality: 'sparse',
      source: 'test',
    };
    const result = SolarWindSampleSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it('rejects negative density', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: -1.0,
      speed_km_s: 350,
      temperature_k: 80000,
      bx_nT: 0,
      by_nT: 0,
      bz_nT: 0,
      bt_nT: 0,
      quality: 'fresh',
      source: 'test',
    };
    const result = SolarWindSampleSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });

  it('rejects negative speed', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: 5.0,
      speed_km_s: -100,
      temperature_k: 80000,
      bx_nT: 0,
      by_nT: 0,
      bz_nT: 0,
      bt_nT: 0,
      quality: 'fresh',
      source: 'test',
    };
    const result = SolarWindSampleSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });

  it('rejects invalid quality flag', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: 5.0,
      speed_km_s: 350,
      temperature_k: 80000,
      bx_nT: 0,
      by_nT: 0,
      bz_nT: 0,
      bt_nT: 0,
      quality: 'invalid_quality',
      source: 'test',
    };
    const result = SolarWindSampleSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });

  it('rejects missing timestamp', () => {
    const sample = {
      density_p_cc: 5.0,
      speed_km_s: 350,
      temperature_k: 80000,
      bx_nT: 0,
      by_nT: 0,
      bz_nT: 0,
      bt_nT: 0,
      quality: 'fresh',
      source: 'test',
    };
    const result = SolarWindSampleSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });
});

describe('FlareEventSchema', () => {
  it('parses an M-class flare event', () => {
    const event = {
      id: 'test-flare-001',
      begin_time_utc: '2024-05-10T11:50:00.000Z',
      peak_time_utc: '2024-05-10T12:00:00.000Z',
      end_time_utc: '2024-05-10T12:15:00.000Z',
      flare_class: 'M',
      class_magnitude: 2.1,
      peak_flux_wm2: 2.1e-5,
      source_lat_deg: 15,
      source_lon_deg: -30,
      active_region: 13664,
      quality: 'fresh',
      source: 'test',
    };
    const result = FlareEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('accepts null for optional fields', () => {
    const event = {
      id: 'test-flare-002',
      begin_time_utc: '2024-05-10T11:50:00.000Z',
      peak_time_utc: null,
      end_time_utc: null,
      flare_class: 'C',
      class_magnitude: null,
      peak_flux_wm2: null,
      source_lat_deg: null,
      source_lon_deg: null,
      active_region: null,
      quality: 'sparse',
      source: 'test',
    };
    const result = FlareEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('rejects latitude outside [-90, 90]', () => {
    const event = {
      id: 'test-flare-003',
      begin_time_utc: '2024-05-10T11:50:00.000Z',
      peak_time_utc: null,
      end_time_utc: null,
      flare_class: 'M',
      class_magnitude: 1.0,
      peak_flux_wm2: null,
      source_lat_deg: 100,
      source_lon_deg: 0,
      active_region: null,
      quality: 'fresh',
      source: 'test',
    };
    const result = FlareEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe('CMEEventSchema', () => {
  it('parses a fast halo CME', () => {
    const cme = {
      id: 'test-cme-001',
      start_time_utc: '2024-10-29T23:00:00.000Z',
      speed_km_s: 1800,
      half_angle_deg: 90,
      is_earth_directed: true,
      estimated_arrival_utc: null,
      estimated_arrival_speed_km_s: null,
      arrival_confidence: 0,
      associated_flare_ids: ['test-flare-001'],
      quality: 'fresh',
      source: 'test',
    };
    const result = CMEEventSchema.safeParse(cme);
    expect(result.success).toBe(true);
  });

  it('rejects arrival_confidence outside [0, 1]', () => {
    const cme = {
      id: 'test-cme-002',
      start_time_utc: '2024-10-29T23:00:00.000Z',
      speed_km_s: 500,
      half_angle_deg: 30,
      is_earth_directed: false,
      estimated_arrival_utc: null,
      estimated_arrival_speed_km_s: null,
      arrival_confidence: 1.5,
      associated_flare_ids: [],
      quality: 'fresh',
      source: 'test',
    };
    const result = CMEEventSchema.safeParse(cme);
    expect(result.success).toBe(false);
  });
});

describe('GeomagneticIndexSampleSchema', () => {
  it('parses official Kp data', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      kp: 5,
      storm_phase: 'minor_storm',
      origin: 'official_reference',
      quality: 'fresh',
      source: 'NOAA',
    };
    const result = GeomagneticIndexSampleSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it('parses simulation estimate Kp data', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      kp: 4.7,
      storm_phase: 'active',
      origin: 'simulation_estimate',
      quality: 'fresh',
      source: 'Helioshield Model',
    };
    const result = GeomagneticIndexSampleSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it('rejects Kp outside [0, 9]', () => {
    const sample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      kp: 10,
      storm_phase: 'quiet',
      origin: 'simulation_estimate',
      quality: 'fresh',
      source: 'test',
    };
    const result = GeomagneticIndexSampleSchema.safeParse(sample);
    expect(result.success).toBe(false);
  });
});

describe('ImpactAssessmentSchema', () => {
  it('parses a complete impact assessment', () => {
    const impact = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      aurora_boundary_lat_deg: 55,
      aurora_risk: 'moderate',
      satellite_drag_risk: 'low',
      hf_radio_risk: 'none',
      power_grid_risk: 'none',
      explanations: {
        aurora: 'Kp estimated at 5.2 — aurora may be visible at ~55° latitude',
        satellite: 'Moderate thermospheric heating — slight orbit decay increase',
      },
      origin: 'simulation_estimate',
      quality: 'fresh',
    };
    const result = ImpactAssessmentSchema.safeParse(impact);
    expect(result.success).toBe(true);
  });

  it('rejects aurora boundary outside [0, 90]', () => {
    const impact = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      aurora_boundary_lat_deg: -5,
      aurora_risk: 'severe',
      satellite_drag_risk: 'severe',
      hf_radio_risk: 'severe',
      power_grid_risk: 'severe',
      explanations: {},
      origin: 'simulation_estimate',
      quality: 'fresh',
    };
    const result = ImpactAssessmentSchema.safeParse(impact);
    expect(result.success).toBe(false);
  });
});
