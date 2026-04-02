/**
 * GlobalSim Helioshield — Scientific Core Tests
 *
 * Tests for propagation estimator, magnetosphere response, and impact scorer.
 * Validates against known physical expectations.
 */

import { describe, it, expect } from 'vitest';
import { PropagationEstimator } from '../../services/propagation-estimator';
import {
  computeNewellCoupling,
  couplingToKp,
  classifyStormPhase,
  MagnetosphereResponseEstimator,
} from '../../services/magnetosphere-response';
import {
  auroraEquatorwardBoundary,
  classifySatelliteDragRisk,
  classifyHFRadioRisk,
  classifyPowerGridRisk,
  ImpactScorer,
} from '../../services/impact-scorer';
import type { CMEEvent, SolarWindSample, FlareEvent } from '../../domain/models';

// ── Propagation Estimator ─────────────────────────────────────────────────────

describe('PropagationEstimator', () => {
  const estimator = new PropagationEstimator();

  it('estimates fast CME arrives within ~18-30 hours', () => {
    const cme: CMEEvent = {
      id: 'test-cme-fast',
      start_time_utc: '2024-10-29T23:00:00.000Z',
      speed_km_s: 1800,
      half_angle_deg: 90,
      is_earth_directed: true,
      estimated_arrival_utc: null,
      estimated_arrival_speed_km_s: null,
      arrival_confidence: 0,
      associated_flare_ids: [],
      quality: 'fresh',
      source: 'test',
    };

    const result = estimator.estimate(cme);
    expect(result).not.toBeNull();
    // Fast CME (1800 km/s) — DBM predicts ~30-45h depending on γ and ambient Vsw
    expect(result!.transitTimeHours).toBeGreaterThan(15);
    expect(result!.transitTimeHours).toBeLessThan(50);
    // Arrival speed should decrease (drag deceleration)
    expect(result!.arrivalSpeedKmS).toBeLessThan(1800);
    expect(result!.arrivalSpeedKmS).toBeGreaterThan(300);
    // Confidence should be reasonable for earth-directed fast CME
    expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    // Explanation should mention simulation estimate
    expect(result!.explanation).toContain('Simulation estimate');
  });

  it('estimates slow CME arrives within ~3-5 days', () => {
    const cme: CMEEvent = {
      id: 'test-cme-slow',
      start_time_utc: '2024-10-29T23:00:00.000Z',
      speed_km_s: 400,
      half_angle_deg: 60,
      is_earth_directed: true,
      estimated_arrival_utc: null,
      estimated_arrival_speed_km_s: null,
      arrival_confidence: 0,
      associated_flare_ids: [],
      quality: 'fresh',
      source: 'test',
    };

    const result = estimator.estimate(cme);
    expect(result).not.toBeNull();
    // ~400 km/s CME ≈ ambient speed → minimal drag, transit ~3-5 days
    expect(result!.transitTimeHours).toBeGreaterThan(60);
    expect(result!.transitTimeHours).toBeLessThan(130);
  });

  it('returns null for CME without speed', () => {
    const cme: CMEEvent = {
      id: 'test-cme-no-speed',
      start_time_utc: '2024-10-29T23:00:00.000Z',
      speed_km_s: null,
      half_angle_deg: null,
      is_earth_directed: true,
      estimated_arrival_utc: null,
      estimated_arrival_speed_km_s: null,
      arrival_confidence: 0,
      associated_flare_ids: [],
      quality: 'fresh',
      source: 'test',
    };

    expect(estimator.estimate(cme)).toBeNull();
  });

  it('estimateAll filters Earth-directed CMEs only', () => {
    const cmes: CMEEvent[] = [
      {
        id: 'earth-directed',
        start_time_utc: '2024-01-01T00:00:00.000Z',
        speed_km_s: 800,
        half_angle_deg: 70,
        is_earth_directed: true,
        estimated_arrival_utc: null,
        estimated_arrival_speed_km_s: null,
        arrival_confidence: 0,
        associated_flare_ids: [],
        quality: 'fresh',
        source: 'test',
      },
      {
        id: 'not-earth-directed',
        start_time_utc: '2024-01-01T00:00:00.000Z',
        speed_km_s: 800,
        half_angle_deg: 20,
        is_earth_directed: false,
        estimated_arrival_utc: null,
        estimated_arrival_speed_km_s: null,
        arrival_confidence: 0,
        associated_flare_ids: [],
        quality: 'fresh',
        source: 'test',
      },
    ];

    const results = estimator.estimateAll(cmes);
    expect(results.length).toBe(1);
    expect(results[0].cmeId).toBe('earth-directed');
  });
});

// ── Magnetosphere Response ────────────────────────────────────────────────────

describe('computeNewellCoupling', () => {
  it('returns 0 for northward Bz (By=0, Bz=5)', () => {
    // θ_c = atan2(0, 5) = 0 → sin(0) = 0 → coupling = 0
    const c = computeNewellCoupling(400, 0, 5);
    expect(c).toBeCloseTo(0, 5);
  });

  it('returns max coupling for strong southward Bz', () => {
    // Bz = -20 nT, By = 0 → θ_c = π → sin(π/2) = 1
    const c = computeNewellCoupling(600, 0, -20);
    expect(c).toBeGreaterThan(10000);
  });

  it('coupling increases with speed', () => {
    const c400 = computeNewellCoupling(400, 0, -10);
    const c800 = computeNewellCoupling(800, 0, -10);
    expect(c800).toBeGreaterThan(c400);
  });

  it('coupling increases with stronger southward Bz', () => {
    const c5 = computeNewellCoupling(400, 0, -5);
    const c15 = computeNewellCoupling(400, 0, -15);
    expect(c15).toBeGreaterThan(c5);
  });

  it('returns 0 for zero speed', () => {
    expect(computeNewellCoupling(0, 0, -10)).toBe(0);
  });
});

describe('couplingToKp', () => {
  it('returns 0 for negligible coupling', () => {
    expect(couplingToKp(5)).toBe(0);
  });

  it('returns bounded values for reasonable coupling', () => {
    const kp = couplingToKp(5000);
    expect(kp).toBeGreaterThan(3);
    expect(kp).toBeLessThan(7);
  });

  it('clamps at 9 for extreme coupling', () => {
    expect(couplingToKp(1e10)).toBe(9);
  });

  it('is monotonically increasing', () => {
    const values = [100, 500, 1000, 5000, 10000, 50000];
    const kps = values.map(couplingToKp);
    for (let i = 1; i < kps.length; i++) {
      expect(kps[i]).toBeGreaterThanOrEqual(kps[i - 1]);
    }
  });
});

describe('classifyStormPhase', () => {
  it('classifies quiet (Kp < 4)', () => expect(classifyStormPhase(2)).toBe('quiet'));
  it('classifies active (Kp = 4)', () => expect(classifyStormPhase(4)).toBe('active'));
  it('classifies minor storm (Kp = 5)', () => expect(classifyStormPhase(5)).toBe('minor_storm'));
  it('classifies moderate storm (Kp = 6)', () => expect(classifyStormPhase(6)).toBe('moderate_storm'));
  it('classifies strong storm (Kp = 7)', () => expect(classifyStormPhase(7)).toBe('strong_storm'));
  it('classifies severe storm (Kp = 8)', () => expect(classifyStormPhase(8)).toBe('severe_storm'));
  it('classifies extreme storm (Kp = 9)', () => expect(classifyStormPhase(9)).toBe('extreme_storm'));
});

describe('MagnetosphereResponseEstimator', () => {
  const estimator = new MagnetosphereResponseEstimator();

  it('produces quiet estimate for northward Bz', () => {
    const sw: SolarWindSample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: 5,
      speed_km_s: 350,
      temperature_k: 80000,
      bx_nT: -2,
      by_nT: 1.5,
      bz_nT: 2.0,
      bt_nT: 3.2,
      quality: 'fresh',
      source: 'test',
    };

    const result = estimator.estimate(sw);
    expect(result).not.toBeNull();
    // Bz=+2 with By=1.5 → small but non-zero coupling due to clock angle
    expect(result!.kpEstimate).toBeLessThan(4);
    expect(result!.stormPhase).toBe('quiet');
    expect(result!.sample.origin).toBe('simulation_estimate');
  });

  it('produces elevated estimate for southward Bz + fast wind', () => {
    const sw: SolarWindSample = {
      timestamp_utc: '2024-05-10T12:03:00.000Z',
      density_p_cc: 15,
      speed_km_s: 535,
      temperature_k: 200000,
      bx_nT: -4.8,
      by_nT: 3.5,
      bz_nT: -10.8,
      bt_nT: 12.2,
      quality: 'fresh',
      source: 'test',
    };

    const result = estimator.estimate(sw);
    expect(result).not.toBeNull();
    expect(result!.kpEstimate).toBeGreaterThan(3);
    expect(result!.stormPhase).not.toBe('quiet');
  });

  it('returns null for sample with missing Bz', () => {
    const sw: SolarWindSample = {
      timestamp_utc: '2024-01-15T00:00:00.000Z',
      density_p_cc: 5,
      speed_km_s: 350,
      temperature_k: 80000,
      bx_nT: null,
      by_nT: null,
      bz_nT: null,
      bt_nT: null,
      quality: 'sparse',
      source: 'test',
    };

    expect(estimator.estimate(sw)).toBeNull();
  });
});

// ── Impact Scorer ─────────────────────────────────────────────────────────────

describe('auroraEquatorwardBoundary', () => {
  it('returns ~67.65° for Kp=0 (polar only)', () => {
    const lat = auroraEquatorwardBoundary(0);
    expect(lat).toBeCloseTo(67.65, 0);
  });

  it('returns lower latitude for Kp=9 (extreme storm)', () => {
    const lat = auroraEquatorwardBoundary(9);
    expect(lat).toBeLessThan(50);
    expect(lat).toBeGreaterThan(30);
  });

  it('boundary latitude decreases with increasing Kp', () => {
    const kp0 = auroraEquatorwardBoundary(0);
    const kp5 = auroraEquatorwardBoundary(5);
    const kp9 = auroraEquatorwardBoundary(9);
    expect(kp5).toBeLessThan(kp0);
    expect(kp9).toBeLessThan(kp5);
  });
});

describe('classifySatelliteDragRisk', () => {
  it('returns none for quiet Kp', () => expect(classifySatelliteDragRisk(1)).toBe('none'));
  it('returns low for moderate Kp', () => expect(classifySatelliteDragRisk(4)).toBe('low'));
  it('returns severe for extreme Kp', () => expect(classifySatelliteDragRisk(9)).toBe('severe'));
});

describe('classifyHFRadioRisk', () => {
  it('returns none for no flare', () => expect(classifyHFRadioRisk(null)).toBe('none'));
  it('returns moderate for M-class', () => {
    const flare: FlareEvent = {
      id: 'test',
      begin_time_utc: '2024-01-01T00:00:00.000Z',
      peak_time_utc: null,
      end_time_utc: null,
      flare_class: 'M',
      class_magnitude: 1.0,
      peak_flux_wm2: null,
      source_lat_deg: null,
      source_lon_deg: null,
      active_region: null,
      quality: 'fresh',
      source: 'test',
    };
    expect(classifyHFRadioRisk(flare)).toBe('moderate');
  });
  it('returns severe for X-class', () => {
    const flare: FlareEvent = {
      id: 'test',
      begin_time_utc: '2024-01-01T00:00:00.000Z',
      peak_time_utc: null,
      end_time_utc: null,
      flare_class: 'X',
      class_magnitude: 1.0,
      peak_flux_wm2: null,
      source_lat_deg: null,
      source_lon_deg: null,
      active_region: null,
      quality: 'fresh',
      source: 'test',
    };
    expect(classifyHFRadioRisk(flare)).toBe('severe');
  });
});

describe('ImpactScorer', () => {
  const scorer = new ImpactScorer();

  it('produces quiet impact for low Kp / no flare', () => {
    const result = scorer.score({
      kpEstimate: 1,
      latestFlare: null,
      couplingRateOfChange: 0,
      quality: 'fresh',
    });
    // Kp=1 → aurora boundary ~64° → 'low' (high-latitude aurora visible)
    expect(['none', 'low']).toContain(result.aurora_risk);
    expect(result.satellite_drag_risk).toBe('none');
    expect(result.hf_radio_risk).toBe('none');
    expect(result.power_grid_risk).toBe('none');
    expect(result.origin).toBe('simulation_estimate');
    expect(result.explanations.aurora).toBeDefined();
  });

  it('produces elevated impact for high Kp + X flare', () => {
    const xFlare: FlareEvent = {
      id: 'test',
      begin_time_utc: '2024-01-01T00:00:00.000Z',
      peak_time_utc: null,
      end_time_utc: null,
      flare_class: 'X',
      class_magnitude: 2.3,
      peak_flux_wm2: null,
      source_lat_deg: null,
      source_lon_deg: null,
      active_region: null,
      quality: 'fresh',
      source: 'test',
    };
    const result = scorer.score({
      kpEstimate: 8,
      latestFlare: xFlare,
      couplingRateOfChange: 8000,
      quality: 'fresh',
    });
    expect(result.aurora_risk).not.toBe('none');
    expect(result.satellite_drag_risk).toBe('severe');
    expect(result.hf_radio_risk).toBe('severe');
    expect(result.power_grid_risk).toBe('high');
  });

  it('computeCouplingRate returns 0 for insufficient data', () => {
    expect(ImpactScorer.computeCouplingRate([])).toBe(0);
    expect(ImpactScorer.computeCouplingRate([{ timestamp_utc: '2024-01-01T00:00:00Z', coupling: 100 }])).toBe(0);
  });

  it('computeCouplingRate calculates correct rate', () => {
    const rate = ImpactScorer.computeCouplingRate([
      { timestamp_utc: '2024-01-01T00:00:00Z', coupling: 1000 },
      { timestamp_utc: '2024-01-01T00:01:00Z', coupling: 2000 },
    ]);
    expect(rate).toBeCloseTo(1000, 0); // 1000 units per minute
  });
});
