/**
 * GlobalSim Helioshield — Utility Function Tests
 */

import { describe, it, expect } from 'vitest';
import { clamp, safePow, rk4Step, rk4Integrate, vectorMagnitude, clockAngle } from '../../lib/math';
import { parseTimestamp, toISOUTC, isWithinMinutes, formatDateYMD } from '../../lib/time';
import { classifyFlareFlux, dynamicPressure_nPa, geomagToGeographic } from '../../lib/units';
import { TTLCache } from '../../lib/cache';

// ── Math Utils ────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('clamps below minimum', () => expect(clamp(-1, 0, 9)).toBe(0));
  it('clamps above maximum', () => expect(clamp(10, 0, 9)).toBe(9));
  it('passes through in-range value', () => expect(clamp(5, 0, 9)).toBe(5));
  it('handles equal min/max', () => expect(clamp(5, 3, 3)).toBe(3));
});

describe('safePow', () => {
  it('handles positive base with fractional exponent', () => {
    expect(safePow(4, 0.5)).toBeCloseTo(2, 10);
  });
  it('handles negative base by clamping to 0', () => {
    expect(safePow(-2, 8 / 3)).toBe(0);
  });
  it('handles zero base', () => {
    expect(safePow(0, 8 / 3)).toBe(0);
  });
  it('computes sin^(8/3) for Newell coupling', () => {
    const val = safePow(Math.sin(Math.PI / 2), 8 / 3);
    expect(val).toBeCloseTo(1.0, 10);
  });
});

describe('rk4Step', () => {
  it('integrates dy/dt = 1 (constant) over dt=1', () => {
    const result = rk4Step((_t, _y) => 1, 0, 0, 1);
    expect(result).toBeCloseTo(1.0, 10);
  });

  it('integrates dy/dt = -y (exponential decay) from y=1, dt=0.1', () => {
    const result = rk4Step((_t, y) => -y, 0, 1, 0.1);
    const expected = Math.exp(-0.1);
    expect(result).toBeCloseTo(expected, 5);
  });

  it('integrates dy/dt = 2t (quadratic) from t=0, y=0, dt=1', () => {
    const result = rk4Step((t, _y) => 2 * t, 0, 0, 1);
    expect(result).toBeCloseTo(1.0, 5); // ∫₀¹ 2t dt = 1
  });
});

describe('rk4Integrate', () => {
  it('integrates constant derivative over 10 steps', () => {
    const trajectory = rk4Integrate((_t, _y) => 1, 0, 0, 1, 10);
    expect(trajectory).toHaveLength(11); // initial + 10 steps
    expect(trajectory[10].y).toBeCloseTo(10.0, 10);
  });

  it('supports early stop', () => {
    const trajectory = rk4Integrate((_t, _y) => 1, 0, 0, 1, 100, (_t, y) => y >= 5);
    expect(trajectory[trajectory.length - 1].y).toBeCloseTo(5.0, 10);
    expect(trajectory.length).toBeLessThan(102);
  });
});

describe('vectorMagnitude', () => {
  it('computes 3D magnitude', () => {
    expect(vectorMagnitude(3, 4, 0)).toBeCloseTo(5, 10);
  });
  it('handles all zeros', () => {
    expect(vectorMagnitude(0, 0, 0)).toBe(0);
  });
});

describe('clockAngle', () => {
  it('returns ~0 for northward Bz (weak coupling)', () => {
    const theta = clockAngle(0, 5);
    expect(theta).toBeCloseTo(0, 5);
  });
  it('returns ~π for southward Bz (strong coupling)', () => {
    const theta = clockAngle(0, -5);
    expect(theta).toBeCloseTo(Math.PI, 5);
  });
  it('returns ~π/2 for pure By', () => {
    const theta = clockAngle(5, 0);
    expect(theta).toBeCloseTo(Math.PI / 2, 5);
  });
});

// ── Time Utils ────────────────────────────────────────────────────────────────

describe('parseTimestamp', () => {
  it('parses NOAA format "YYYY-MM-DD HH:mm:ss.SSS"', () => {
    const d = parseTimestamp('2024-01-15 12:30:00.000');
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(12);
    expect(d!.getUTCMinutes()).toBe(30);
  });

  it('parses ISO 8601 with Z', () => {
    const d = parseTimestamp('2024-01-15T12:30:00Z');
    expect(d).not.toBeNull();
    expect(d!.getUTCHours()).toBe(12);
  });

  it('returns null for empty string', () => {
    expect(parseTimestamp('')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseTimestamp('not-a-date')).toBeNull();
  });
});

describe('toISOUTC', () => {
  it('converts NOAA format to ISO', () => {
    const iso = toISOUTC('2024-01-15 12:30:00.000');
    expect(iso).toBe('2024-01-15T12:30:00.000Z');
  });

  it('returns null for null input', () => {
    expect(toISOUTC(null)).toBeNull();
  });

  it('handles Date object', () => {
    const iso = toISOUTC(new Date('2024-01-15T12:30:00Z'));
    expect(iso).toBe('2024-01-15T12:30:00.000Z');
  });
});

describe('formatDateYMD', () => {
  it('formats date as YYYY-MM-DD', () => {
    const d = new Date('2024-01-05T00:00:00Z');
    expect(formatDateYMD(d)).toBe('2024-01-05');
  });
});

// ── Unit Conversions ──────────────────────────────────────────────────────────

describe('classifyFlareFlux', () => {
  it('classifies A-class', () => {
    expect(classifyFlareFlux(5e-8).cls).toBe('A');
  });
  it('classifies B-class', () => {
    expect(classifyFlareFlux(5e-7).cls).toBe('B');
  });
  it('classifies C-class', () => {
    expect(classifyFlareFlux(5e-6).cls).toBe('C');
  });
  it('classifies M-class with magnitude', () => {
    const r = classifyFlareFlux(2.1e-5);
    expect(r.cls).toBe('M');
    expect(r.magnitude).toBeCloseTo(2.1, 1);
  });
  it('classifies X-class', () => {
    expect(classifyFlareFlux(2.3e-4).cls).toBe('X');
    expect(classifyFlareFlux(2.3e-4).magnitude).toBeCloseTo(2.3, 1);
  });
});

describe('dynamicPressure_nPa', () => {
  it('computes Pdyn for typical solar wind', () => {
    // Np=5 p/cc, Vsw=400 km/s → Pdyn ≈ 1.6726e-6 × 5 × 160000 ≈ 1.34 nPa
    const pdyn = dynamicPressure_nPa(5, 400);
    expect(pdyn).toBeCloseTo(1.338, 1);
  });

  it('returns 0 for zero density', () => {
    expect(dynamicPressure_nPa(0, 400)).toBe(0);
  });

  it('returns 0 for zero speed', () => {
    expect(dynamicPressure_nPa(5, 0)).toBe(0);
  });
});

describe('geomagToGeographic', () => {
  it('converts 77° geomag → ~67.65° geo (polar)', () => {
    // Offset = 90 - 80.65 = 9.35°
    expect(geomagToGeographic(77)).toBeCloseTo(67.65, 1);
  });
});

// ── Cache ─────────────────────────────────────────────────────────────────────

describe('TTLCache', () => {
  it('stores and retrieves a value', () => {
    const cache = new TTLCache();
    cache.set('key', 'value', 10000);
    expect(cache.get('key')).toBe('value');
  });

  it('returns null for expired entries', async () => {
    const cache = new TTLCache();
    cache.set('key', 'value', 10); // 10ms TTL
    await new Promise((r) => setTimeout(r, 50));
    expect(cache.get('key')).toBeNull();
  });

  it('returns null for missing keys', () => {
    const cache = new TTLCache();
    expect(cache.get('missing')).toBeNull();
  });

  it('invalidates a key', () => {
    const cache = new TTLCache();
    cache.set('key', 'value', 10000);
    cache.invalidate('key');
    expect(cache.get('key')).toBeNull();
  });

  it('clears all entries', () => {
    const cache = new TTLCache();
    cache.set('a', 1, 10000);
    cache.set('b', 2, 10000);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
