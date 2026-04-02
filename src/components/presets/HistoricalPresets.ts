/**
 * GlobalSim Helioshield — Historical Event Preset Selector
 *
 * Lightweight mock-data preset loader for demonstrating the dashboard
 * with predefined space weather scenarios when live data is unavailable
 * or for educational comparison.
 *
 * Presets:
 *   - Quiet Period: solar minimum conditions
 *   - Moderate Storm: Kp 5-6, sustained southward Bz
 *   - Strong CME: fast halo CME with X-class flare
 */

import type { SolarWindSample, FlareEvent, CMEEvent, GeomagneticIndexSample } from '../../domain/models';

export type PresetId = 'quiet' | 'moderate' | 'strong';

export interface PresetScenario {
  id: PresetId;
  label: string;
  description: string;
  solarWind: SolarWindSample[];
  flares: FlareEvent[];
  cmes: CMEEvent[];
  officialKp: GeomagneticIndexSample[];
}

/** Generate time-series samples spread across the past N hours */
function generateTimeSeries(
  count: number,
  hoursBack: number,
  builder: (minuteOffset: number) => Partial<SolarWindSample>
): SolarWindSample[] {
  const now = Date.now();
  const stepMs = (hoursBack * 3600_000) / count;
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - hoursBack * 3600_000 + i * stepMs);
    const minuteOffset = i * (hoursBack * 60) / count;
    const overrides = builder(minuteOffset);
    return {
      timestamp_utc: t.toISOString(),
      density_p_cc: overrides.density_p_cc ?? 5.0,
      speed_km_s: overrides.speed_km_s ?? 350,
      temperature_k: overrides.temperature_k ?? 80000,
      bx_nT: overrides.bx_nT ?? -1,
      by_nT: overrides.by_nT ?? 1,
      bz_nT: overrides.bz_nT ?? 2,
      bt_nT: overrides.bt_nT ?? 3,
      quality: 'fresh' as const,
      source: `Helioshield Preset`,
    };
  });
}

function makeKp(hoursBack: number, values: number[]): GeomagneticIndexSample[] {
  const now = Date.now();
  const step = hoursBack * 3600_000 / values.length;
  return values.map((kp, i) => ({
    timestamp_utc: new Date(now - hoursBack * 3600_000 + i * step).toISOString(),
    kp,
    storm_phase: kp >= 5 ? 'minor_storm' : kp >= 4 ? 'active' : 'quiet',
    origin: 'official_reference' as const,
    quality: 'fresh' as const,
    source: 'NOAA (Preset)',
  }));
}

export const PRESETS: PresetScenario[] = [
  {
    id: 'quiet',
    label: '☀️ Quiet Period',
    description: 'Solar minimum — Vsw ~350 km/s, Bz northward, no flares',
    solarWind: generateTimeSeries(120, 24, () => ({
      speed_km_s: 330 + Math.random() * 40,
      density_p_cc: 3 + Math.random() * 3,
      bz_nT: 1 + Math.random() * 3,
      bt_nT: 2 + Math.random() * 2,
      temperature_k: 60000 + Math.random() * 30000,
    })),
    flares: [],
    cmes: [],
    officialKp: makeKp(24, [1, 1, 2, 1, 1, 2, 1, 1]),
  },
  {
    id: 'moderate',
    label: '🌀 Moderate Storm',
    description: 'Kp 5-6 event — Vsw ~540 km/s, sustained southward Bz -10 nT',
    solarWind: generateTimeSeries(120, 24, (m) => {
      const phase = m / (24 * 60);
      const stormPeak = phase > 0.3 && phase < 0.7;
      return {
        speed_km_s: stormPeak ? 480 + Math.random() * 120 : 350 + Math.random() * 50,
        density_p_cc: stormPeak ? 12 + Math.random() * 8 : 4 + Math.random() * 3,
        bz_nT: stormPeak ? -8 - Math.random() * 6 : 1 + Math.random() * 3,
        bt_nT: stormPeak ? 10 + Math.random() * 5 : 3 + Math.random() * 2,
        temperature_k: stormPeak ? 200000 + Math.random() * 100000 : 80000,
      };
    }),
    flares: [
      {
        id: 'preset-flare-m2',
        begin_time_utc: new Date(Date.now() - 14 * 3600_000).toISOString(),
        peak_time_utc: new Date(Date.now() - 13.5 * 3600_000).toISOString(),
        end_time_utc: new Date(Date.now() - 13 * 3600_000).toISOString(),
        flare_class: 'M',
        class_magnitude: 2.1,
        peak_flux_wm2: 2.1e-5,
        source_lat_deg: 15,
        source_lon_deg: -25,
        active_region: 13664,
        quality: 'fresh',
        source: 'Preset',
      },
    ],
    cmes: [],
    officialKp: makeKp(24, [2, 3, 4, 5, 6, 5, 4, 3]),
  },
  {
    id: 'strong',
    label: '💥 Strong CME',
    description: 'Fast halo CME + X2.3 flare — Kp 7-9, Bz -35 nT',
    solarWind: generateTimeSeries(120, 24, (m) => {
      const phase = m / (24 * 60);
      const shockArrival = phase > 0.4 && phase < 0.8;
      return {
        speed_km_s: shockArrival ? 700 + Math.random() * 200 : 380 + Math.random() * 40,
        density_p_cc: shockArrival ? 25 + Math.random() * 15 : 5 + Math.random() * 3,
        bz_nT: shockArrival ? -25 - Math.random() * 15 : 2 + Math.random() * 3,
        bt_nT: shockArrival ? 30 + Math.random() * 10 : 4 + Math.random() * 2,
        temperature_k: shockArrival ? 500000 + Math.random() * 300000 : 80000,
      };
    }),
    flares: [
      {
        id: 'preset-flare-x2',
        begin_time_utc: new Date(Date.now() - 18 * 3600_000).toISOString(),
        peak_time_utc: new Date(Date.now() - 17.5 * 3600_000).toISOString(),
        end_time_utc: new Date(Date.now() - 17 * 3600_000).toISOString(),
        flare_class: 'X',
        class_magnitude: 2.3,
        peak_flux_wm2: 2.3e-4,
        source_lat_deg: -12,
        source_lon_deg: 10,
        active_region: 13590,
        quality: 'fresh',
        source: 'Preset',
      },
    ],
    cmes: [
      {
        id: 'preset-cme-halo',
        start_time_utc: new Date(Date.now() - 17 * 3600_000).toISOString(),
        speed_km_s: 1800,
        half_angle_deg: 90,
        is_earth_directed: true,
        estimated_arrival_utc: null,
        estimated_arrival_speed_km_s: null,
        arrival_confidence: 0,
        associated_flare_ids: ['preset-flare-x2'],
        quality: 'fresh',
        source: 'Preset',
      },
    ],
    officialKp: makeKp(24, [2, 3, 5, 7, 8, 9, 7, 5]),
  },
];
