/**
 * GlobalSim Helioshield — Adapter Parsing Tests
 *
 * Tests adapter parseRaw and normalize methods using mock fixtures.
 * Exercises the full pipeline from raw API response → domain model.
 */

import { describe, it, expect } from 'vitest';
import { NoaaSolarWindAdapter } from '../../services/adapters/noaa-solar-wind';
import { NoaaKpIndexAdapter } from '../../services/adapters/noaa-kp-index';
import { GoesXrayAdapter } from '../../services/adapters/goes-xray';
import { NasaDonkiAdapter } from '../../services/adapters/nasa-donki';

import quietFixture from '../fixtures/quiet-period.json';
import moderateFixture from '../fixtures/moderate-storm.json';
import strongFixture from '../fixtures/strong-cme.json';

// ── Solar Wind Adapter ────────────────────────────────────────────────────────

describe('NoaaSolarWindAdapter', () => {
  const adapter = new NoaaSolarWindAdapter();

  it('parses quiet period plasma data', () => {
    const raw = adapter.parseRaw(quietFixture.solar_wind);
    expect(raw.length).toBe(10); // 10 data rows (header excluded)
  });

  it('normalizes quiet data with correct speed range', () => {
    const raw = adapter.parseRaw(quietFixture.solar_wind);
    const normalized = adapter.normalize(raw);
    expect(normalized.length).toBeGreaterThan(0);
    for (const s of normalized) {
      expect(s.speed_km_s).toBeGreaterThanOrEqual(340);
      expect(s.speed_km_s).toBeLessThanOrEqual(360);
    }
  });

  it('normalizes moderate storm data with elevated speed', () => {
    const raw = adapter.parseRaw(moderateFixture.solar_wind);
    const normalized = adapter.normalize(raw);
    for (const s of normalized) {
      expect(s.speed_km_s).toBeGreaterThanOrEqual(500);
      expect(s.speed_km_s).toBeLessThanOrEqual(560);
    }
  });

  it('handles missing/invalid values gracefully', () => {
    const badData = [
      ["time_tag", "density", "speed", "temperature"],
      ["2024-01-15 00:00:00.000", "-999.9", "350", "80000"],
      ["2024-01-15 00:01:00.000", "5.0", "-999.9", "80000"],
      ["", "5.0", "350", "80000"],
    ];
    const raw = adapter.parseRaw(badData);
    const normalized = adapter.normalize(raw);
    // First row: density is null (-999.9), count = 2 valid entries
    expect(raw.length).toBe(2); // empty timestamp skipped
    const withNullDensity = normalized.find(s => s.density_p_cc === null);
    expect(withNullDensity).toBeDefined();
    expect(withNullDensity!.quality).toBe('sparse');
  });

  it('rejects completely empty rows', () => {
    const badData = [
      ["time_tag", "density", "speed", "temperature"],
      ["2024-01-15 00:00:00.000", "-999.9", "-999.9", "-999.9"],
    ];
    const raw = adapter.parseRaw(badData);
    const normalized = adapter.normalize(raw);
    expect(normalized.length).toBe(0); // All nulls → skipped
  });
});

// ── Kp Index Adapter ──────────────────────────────────────────────────────────

describe('NoaaKpIndexAdapter', () => {
  const adapter = new NoaaKpIndexAdapter();

  it('parses quiet period Kp data', () => {
    const raw = adapter.parseRaw(quietFixture.kp_index);
    expect(raw.length).toBe(3);
  });

  it('normalizes with correct storm phase for quiet period', () => {
    const raw = adapter.parseRaw(quietFixture.kp_index);
    const normalized = adapter.normalize(raw);
    for (const s of normalized) {
      expect(s.storm_phase).toBe('quiet');
      expect(s.origin).toBe('official_reference');
    }
  });

  it('classifies moderate storm correctly', () => {
    const raw = adapter.parseRaw(moderateFixture.kp_index);
    const normalized = adapter.normalize(raw);
    const kp6 = normalized.find(s => s.kp === 6);
    expect(kp6).toBeDefined();
    expect(kp6!.storm_phase).toBe('moderate_storm');
  });

  it('classifies strong storm correctly', () => {
    const raw = adapter.parseRaw(strongFixture.kp_index);
    const normalized = adapter.normalize(raw);
    const kp8 = normalized.find(s => s.kp === 8);
    expect(kp8).toBeDefined();
    expect(kp8!.storm_phase).toBe('severe_storm');
  });

  it('rejects Kp values out of [0, 9]', () => {
    const badData = [
      ["time_tag", "Kp", "Kp_fraction", "a_running", "station_count"],
      ["2024-01-15 00:00:00.000", "10", "0", "0", "8"],
      ["2024-01-15 00:00:00.000", "-1", "0", "0", "8"],
    ];
    const raw = adapter.parseRaw(badData);
    expect(raw.length).toBe(0);
  });
});

// ── GOES X-ray Adapter ────────────────────────────────────────────────────────

describe('GoesXrayAdapter', () => {
  const adapter = new GoesXrayAdapter();

  it('parses quiet period — no flares detected', () => {
    const raw = adapter.parseRaw(quietFixture.goes_xray);
    const normalized = adapter.normalize(raw);
    // Quiet period: all A-class, no peaks above C threshold
    expect(normalized.length).toBe(0);
  });

  it('detects M-class flare in moderate storm', () => {
    const raw = adapter.parseRaw(moderateFixture.goes_xray);
    const normalized = adapter.normalize(raw);
    expect(normalized.length).toBeGreaterThan(0);
    const mFlare = normalized.find(f => f.flare_class === 'M');
    expect(mFlare).toBeDefined();
  });

  it('detects X-class flare in strong CME scenario', () => {
    const raw = adapter.parseRaw(strongFixture.goes_xray);
    const normalized = adapter.normalize(raw);
    expect(normalized.length).toBeGreaterThan(0);
    const xFlare = normalized.find(f => f.flare_class === 'X');
    expect(xFlare).toBeDefined();
  });
});

// ── NASA DONKI Adapter ────────────────────────────────────────────────────────

describe('NasaDonkiAdapter', () => {
  const adapter = new NasaDonkiAdapter();

  it('parses empty CME list for quiet period', () => {
    const cmes = (adapter as any).parseCMEs(quietFixture.donki_cme);
    expect(cmes.length).toBe(0);
  });

  it('parses fast halo CME from strong event', () => {
    const cmes = (adapter as any).parseCMEs(strongFixture.donki_cme);
    expect(cmes.length).toBe(1);
    expect(cmes[0].speed_km_s).toBe(1800);
    expect(cmes[0].is_earth_directed).toBe(true);
    expect(cmes[0].half_angle_deg).toBe(90);
  });

  it('links CME to associated flare ID', () => {
    const cmes = (adapter as any).parseCMEs(strongFixture.donki_cme);
    expect(cmes[0].associated_flare_ids).toContain('2024-10-29T22:55:00-FLR-001');
  });

  it('parses DONKI flares with source location', () => {
    const flares = (adapter as any).parseFlares(strongFixture.donki_flr);
    expect(flares.length).toBe(1);
    expect(flares[0].flare_class).toBe('X');
    expect(flares[0].class_magnitude).toBeCloseTo(2.3, 1);
    expect(flares[0].source_lat_deg).toBe(-10); // S10 → -10
    expect(flares[0].source_lon_deg).toBe(-20); // W20 → -20
  });

  it('parses M-class flare from moderate storm', () => {
    const flares = (adapter as any).parseFlares(moderateFixture.donki_flr);
    expect(flares.length).toBe(1);
    expect(flares[0].flare_class).toBe('M');
    expect(flares[0].source_lat_deg).toBe(15);  // N15 → 15
    expect(flares[0].source_lon_deg).toBe(-30); // W30 → -30
  });
});
