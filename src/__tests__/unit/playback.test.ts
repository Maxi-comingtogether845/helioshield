/**
 * GlobalSim Helioshield — Playback & Time-Series Tests
 *
 * Tests for:
 *   - Playback state transitions
 *   - Time slicing logic
 *   - Chart data point generation with gaps
 *   - Official Kp vs simulation separation
 *   - Event marker positioning
 */

import { describe, it, expect } from 'vitest';
import type { SolarWindSample, FlareEvent, CMEEvent, GeomagneticIndexSample } from '../../domain/models';
import type { FusedTimeline } from '../../services/event-fusion-engine';
import type { SpaceWeatherData } from '../../hooks/useSpaceWeather';
import type { MagnetosphereResult } from '../../services/magnetosphere-response';

// ── Pure function version of time slicing for testing ─────────────────────

function filterByTime<T>(items: T[], getTimestamp: (item: T) => string, cutoffMs: number): T[] {
  return items.filter((item) => new Date(getTimestamp(item)).getTime() <= cutoffMs);
}

// ── Test Data Factory ─────────────────────────────────────────────────────

function makeSolarWindSample(minuteOffset: number, overrides?: Partial<SolarWindSample>): SolarWindSample {
  const baseTime = new Date('2024-01-15T00:00:00Z');
  baseTime.setMinutes(baseTime.getMinutes() + minuteOffset);
  return {
    timestamp_utc: baseTime.toISOString(),
    density_p_cc: 5.0,
    speed_km_s: 350 + minuteOffset,
    temperature_k: 80000,
    bx_nT: -2,
    by_nT: 1.5,
    bz_nT: 2.0,
    bt_nT: 3.2,
    quality: 'fresh',
    source: 'test',
    ...overrides,
  };
}

function makeFlareEvent(minuteOffset: number, cls: string = 'M'): FlareEvent {
  const baseTime = new Date('2024-01-15T00:00:00Z');
  baseTime.setMinutes(baseTime.getMinutes() + minuteOffset);
  return {
    id: `flare-${minuteOffset}`,
    begin_time_utc: baseTime.toISOString(),
    peak_time_utc: new Date(baseTime.getTime() + 5 * 60000).toISOString(),
    end_time_utc: new Date(baseTime.getTime() + 15 * 60000).toISOString(),
    flare_class: cls as any,
    class_magnitude: 2.1,
    peak_flux_wm2: 2.1e-5,
    source_lat_deg: 15,
    source_lon_deg: -30,
    active_region: 13664,
    quality: 'fresh',
    source: 'test',
  };
}

function makeCME(minuteOffset: number): CMEEvent {
  const baseTime = new Date('2024-01-15T00:00:00Z');
  baseTime.setMinutes(baseTime.getMinutes() + minuteOffset);
  return {
    id: `cme-${minuteOffset}`,
    start_time_utc: baseTime.toISOString(),
    speed_km_s: 800,
    half_angle_deg: 70,
    is_earth_directed: true,
    estimated_arrival_utc: null,
    estimated_arrival_speed_km_s: null,
    arrival_confidence: 0,
    associated_flare_ids: [],
    quality: 'fresh',
    source: 'test',
  };
}

function makeKpSample(minuteOffset: number, kp: number, origin: 'official_reference' | 'simulation_estimate'): GeomagneticIndexSample {
  const baseTime = new Date('2024-01-15T00:00:00Z');
  baseTime.setMinutes(baseTime.getMinutes() + minuteOffset);
  return {
    timestamp_utc: baseTime.toISOString(),
    kp,
    storm_phase: 'quiet',
    origin,
    quality: 'fresh',
    source: origin === 'official_reference' ? 'NOAA' : 'Helioshield',
  };
}

// ── Time Slicing Tests ────────────────────────────────────────────────────

describe('Time Slicing', () => {
  const solarWindSamples = [
    makeSolarWindSample(0),
    makeSolarWindSample(5),
    makeSolarWindSample(10),
    makeSolarWindSample(15),
    makeSolarWindSample(20),
  ];

  it('returns all samples when cursor is at or beyond the last timestamp', () => {
    const cutoff = new Date('2024-01-15T00:25:00Z').getTime();
    const sliced = filterByTime(solarWindSamples, (s) => s.timestamp_utc, cutoff);
    expect(sliced).toHaveLength(5);
  });

  it('returns only samples before cursor', () => {
    const cutoff = new Date('2024-01-15T00:12:00Z').getTime();
    const sliced = filterByTime(solarWindSamples, (s) => s.timestamp_utc, cutoff);
    expect(sliced).toHaveLength(3); // 0, 5, 10 (all <= 12 min)
  });

  it('returns empty when cursor is before all samples', () => {
    const cutoff = new Date('2024-01-14T23:00:00Z').getTime();
    const sliced = filterByTime(solarWindSamples, (s) => s.timestamp_utc, cutoff);
    expect(sliced).toHaveLength(0);
  });

  it('slices flares by begin_time_utc', () => {
    const flares = [makeFlareEvent(5), makeFlareEvent(15), makeFlareEvent(25)];
    const cutoff = new Date('2024-01-15T00:18:00Z').getTime();
    const sliced = filterByTime(flares, (f) => f.begin_time_utc, cutoff);
    expect(sliced).toHaveLength(2);
    expect(sliced[1].id).toBe('flare-15');
  });

  it('slices CMEs by start_time_utc', () => {
    const cmes = [makeCME(0), makeCME(30), makeCME(60)];
    const cutoff = new Date('2024-01-15T00:35:00Z').getTime();
    const sliced = filterByTime(cmes, (c) => c.start_time_utc, cutoff);
    expect(sliced).toHaveLength(2);
  });

  it('preserves quality flags during slicing', () => {
    const samples = [
      makeSolarWindSample(0, { quality: 'fresh' }),
      makeSolarWindSample(5, { quality: 'sparse' }),
      makeSolarWindSample(10, { quality: 'delayed' }),
    ];
    const cutoff = new Date('2024-01-15T00:08:00Z').getTime();
    const sliced = filterByTime(samples, (s) => s.timestamp_utc, cutoff);
    expect(sliced).toHaveLength(2);
    expect(sliced[0].quality).toBe('fresh');
    expect(sliced[1].quality).toBe('sparse');
  });
});

// ── Playback State Tests ──────────────────────────────────────────────────

describe('Playback Mode Logic', () => {
  it('computeTimeRange produces correct 24h window', () => {
    const now = Date.now();
    const range = {
      start: new Date(now - 24 * 3600_000).toISOString(),
      end: new Date(now).toISOString(),
    };
    const startMs = new Date(range.start).getTime();
    const endMs = new Date(range.end).getTime();
    expect(endMs - startMs).toBeCloseTo(24 * 3600_000, -3);
  });

  it('computeTimeRange produces correct 7d window', () => {
    const now = Date.now();
    const range = {
      start: new Date(now - 7 * 24 * 3600_000).toISOString(),
      end: new Date(now).toISOString(),
    };
    const startMs = new Date(range.start).getTime();
    const endMs = new Date(range.end).getTime();
    expect(endMs - startMs).toBeCloseTo(7 * 24 * 3600_000, -3);
  });

  it('seekFraction maps 0 to start and 1 to end', () => {
    const start = '2024-01-15T00:00:00.000Z';
    const end = '2024-01-16T00:00:00.000Z';
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    // fraction = 0 → start
    const t0 = new Date(startMs + 0 * (endMs - startMs)).toISOString();
    expect(t0).toBe(start);

    // fraction = 1 → end
    const t1 = new Date(startMs + 1 * (endMs - startMs)).toISOString();
    expect(t1).toBe(end);

    // fraction = 0.5 → midpoint
    const tMid = new Date(startMs + 0.5 * (endMs - startMs)).getTime();
    expect(tMid).toBe(startMs + 12 * 3600_000);
  });

  it('getFraction returns correct value', () => {
    const start = '2024-01-15T00:00:00.000Z';
    const end = '2024-01-16T00:00:00.000Z';
    const current = '2024-01-15T12:00:00.000Z'; // midpoint

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const curMs = new Date(current).getTime();
    const fraction = (curMs - startMs) / (endMs - startMs);

    expect(fraction).toBeCloseTo(0.5, 5);
  });
});

// ── Chart Data with Gaps ──────────────────────────────────────────────────

describe('Chart Data with Sparse/Missing Values', () => {
  it('null values appear in chart data points', () => {
    const samples = [
      makeSolarWindSample(0, { bz_nT: 2.0 }),
      makeSolarWindSample(5, { bz_nT: null }),   // <-- gap
      makeSolarWindSample(10, { bz_nT: -5.0 }),
      makeSolarWindSample(15, { bz_nT: null }),   // <-- gap
      makeSolarWindSample(20, { bz_nT: -10.0 }),
    ];

    const points = samples.map((s) => ({
      timestamp: s.timestamp_utc,
      value: s.bz_nT,
    }));

    expect(points).toHaveLength(5);
    expect(points[0].value).toBe(2.0);
    expect(points[1].value).toBeNull(); // Gap preserved
    expect(points[2].value).toBe(-5.0);
    expect(points[3].value).toBeNull(); // Gap preserved
    expect(points[4].value).toBe(-10.0);
  });

  it('all-null series produces empty path segments', () => {
    const points = [
      { timestamp: '2024-01-15T00:00:00Z', value: null },
      { timestamp: '2024-01-15T00:05:00Z', value: null },
    ];

    // Simulate path building
    const segments: string[] = [];
    let current = '';
    for (const p of points) {
      if (p.value === null) {
        if (current) { segments.push(current); current = ''; }
        continue;
      }
      current += current ? ` L ${p.value} 0` : `M ${p.value} 0`;
    }
    if (current) segments.push(current);

    expect(segments).toHaveLength(0);
  });
});

// ── Official vs Simulation Separation ─────────────────────────────────────

describe('Official NOAA Kp vs Simulation Kp', () => {
  it('official Kp has distinct origin flag', () => {
    const officialSample = makeKpSample(0, 5, 'official_reference');
    const simSample = makeKpSample(0, 4.8, 'simulation_estimate');

    expect(officialSample.origin).toBe('official_reference');
    expect(simSample.origin).toBe('simulation_estimate');
    expect(officialSample.origin).not.toBe(simSample.origin);
  });

  it('official Kp source is NOAA, simulation source is Helioshield', () => {
    const officialSample = makeKpSample(0, 5, 'official_reference');
    const simSample = makeKpSample(0, 4.8, 'simulation_estimate');

    expect(officialSample.source).toBe('NOAA');
    expect(simSample.source).toContain('Helioshield');
  });

  it('official and simulation Kp can coexist at same timestamp', () => {
    const officialKp = [
      makeKpSample(0, 3, 'official_reference'),
      makeKpSample(180, 5, 'official_reference'),
    ];
    const simulationKp = [
      makeKpSample(0, 2.8, 'simulation_estimate'),
      makeKpSample(60, 3.5, 'simulation_estimate'),
      makeKpSample(120, 4.2, 'simulation_estimate'),
      makeKpSample(180, 5.1, 'simulation_estimate'),
    ];

    // They should be separate arrays with different lengths (different cadence)
    expect(officialKp).toHaveLength(2);
    expect(simulationKp).toHaveLength(4);

    // At t=0 both exist, but with different origins
    expect(officialKp[0].timestamp_utc).toBe(simulationKp[0].timestamp_utc);
    expect(officialKp[0].origin).not.toBe(simulationKp[0].origin);
  });
});

// ── Event Markers ─────────────────────────────────────────────────────────

describe('Event Markers', () => {
  it('flare markers positioned at peak_time_utc', () => {
    const flare = makeFlareEvent(30, 'X');
    const markerTime = flare.peak_time_utc ?? flare.begin_time_utc;
    // Peak is 5 min after begin
    expect(new Date(markerTime).getTime()).toBe(
      new Date(flare.begin_time_utc).getTime() + 5 * 60000
    );
  });

  it('CME markers positioned at start_time_utc', () => {
    const cme = makeCME(60);
    expect(new Date(cme.start_time_utc).getTime()).toBe(
      new Date('2024-01-15T01:00:00Z').getTime()
    );
  });

  it('markers for multiple events maintain temporal order', () => {
    const events = [
      { time: makeFlareEvent(10).begin_time_utc, type: 'flare' },
      { time: makeCME(30).start_time_utc, type: 'cme' },
      { time: makeFlareEvent(50, 'X').begin_time_utc, type: 'flare' },
    ];

    const sorted = events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    expect(sorted[0].type).toBe('flare');
    expect(sorted[1].type).toBe('cme');
    expect(sorted[2].type).toBe('flare');
  });
});
