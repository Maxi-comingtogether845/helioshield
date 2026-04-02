/**
 * GlobalSim Helioshield — Data Source Configuration
 *
 * All endpoints are public NOAA/NASA APIs with CORS support.
 * No server-side proxy required.
 *
 * Rate limits:
 *   NOAA SWPC: No documented hard limit, but be respectful (~1 req/min per endpoint)
 *   NASA DONKI: DEMO_KEY = 30 req/hr, registered key = 1000 req/hr
 */

export interface DataSourceConfig {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly cacheTtlMs: number;
  readonly rateLimitPerMinute: number;
  readonly retryAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly description: string;
}

const NOAA_BASE = 'https://services.swpc.noaa.gov';
const NASA_DONKI_BASE = 'https://api.nasa.gov/DONKI';

/** Default NASA API key — override via VITE_NASA_API_KEY env variable */
const NASA_API_KEY = import.meta.env.VITE_NASA_API_KEY ?? 'DEMO_KEY';

export const DATA_SOURCES: Record<string, DataSourceConfig> = {
  NOAA_SOLAR_WIND_PLASMA: {
    id: 'noaa_sw_plasma',
    name: 'NOAA SWPC Solar Wind Plasma (7-day)',
    url: `${NOAA_BASE}/products/solar-wind/plasma-7-day.json`,
    cacheTtlMs: 60_000, // 1 min — data updates every ~1 min
    rateLimitPerMinute: 2,
    retryAttempts: 3,
    retryBaseDelayMs: 1000,
    description: 'Proton density (Np) and bulk speed (Vsw) from DSCOVR at L1',
  },
  NOAA_SOLAR_WIND_MAG: {
    id: 'noaa_sw_mag',
    name: 'NOAA SWPC Solar Wind Mag (7-day)',
    url: `${NOAA_BASE}/products/solar-wind/mag-7-day.json`,
    cacheTtlMs: 60_000,
    rateLimitPerMinute: 2,
    retryAttempts: 3,
    retryBaseDelayMs: 1000,
    description: 'IMF components Bx, By, Bz and total Bt from DSCOVR at L1',
  },
  NOAA_KP_INDEX: {
    id: 'noaa_kp',
    name: 'NOAA Planetary K-index',
    url: `${NOAA_BASE}/products/noaa-planetary-k-index.json`,
    cacheTtlMs: 180_000, // 3 min — Kp updates every 3 hours
    rateLimitPerMinute: 1,
    retryAttempts: 3,
    retryBaseDelayMs: 1000,
    description: 'Official planetary Kp index (3-hour cadence) from NOAA SWPC',
  },
  GOES_XRAY: {
    id: 'goes_xray',
    name: 'GOES X-ray Flux (7-day)',
    url: `${NOAA_BASE}/json/goes/primary/xrays-7-day.json`,
    cacheTtlMs: 60_000,
    rateLimitPerMinute: 2,
    retryAttempts: 3,
    retryBaseDelayMs: 1000,
    description: 'GOES-16 primary X-ray sensor, 1–8 Å long channel flux',
  },
  NASA_DONKI_CME: {
    id: 'nasa_donki_cme',
    name: 'NASA DONKI CME Events',
    url: `${NASA_DONKI_BASE}/CME?startDate=STARTDATE&endDate=ENDDATE&api_key=${NASA_API_KEY}`,
    cacheTtlMs: 300_000, // 5 min
    rateLimitPerMinute: 1,
    retryAttempts: 2,
    retryBaseDelayMs: 2000,
    description: 'Coronal Mass Ejection events and analysis from NASA DONKI',
  },
  NASA_DONKI_FLR: {
    id: 'nasa_donki_flr',
    name: 'NASA DONKI Solar Flare Events',
    url: `${NASA_DONKI_BASE}/FLR?startDate=STARTDATE&endDate=ENDDATE&api_key=${NASA_API_KEY}`,
    cacheTtlMs: 300_000,
    rateLimitPerMinute: 1,
    retryAttempts: 2,
    retryBaseDelayMs: 2000,
    description: 'Solar flare events with classification from NASA DONKI',
  },
} as const;

/**
 * Build a DONKI URL with actual date range.
 * Dates should be in YYYY-MM-DD format.
 */
export function buildDonkiUrl(
  sourceKey: 'NASA_DONKI_CME' | 'NASA_DONKI_FLR',
  startDate: string,
  endDate: string
): string {
  return DATA_SOURCES[sourceKey].url
    .replace('STARTDATE', startDate)
    .replace('ENDDATE', endDate);
}
