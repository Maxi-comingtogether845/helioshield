# Data Sources

## NOAA SWPC Solar Wind (Plasma + Magnetic Field)

| Property | Value |
|---|---|
| Plasma URL | `https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json` |
| Mag URL | `https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json` |
| Cadence | ~1 minute |
| Retention | 7 days rolling |
| Cache TTL | 60 seconds |
| Auth | None (public) |

Provides speed (km/s), density (p/cm³), temperature (K), Bx/By/Bz/Bt (nT).
Measurements from DSCOVR at L1 Lagrange point (~1.5M km from Earth).

## NOAA SWPC Kp Index

| Property | Value |
|---|---|
| URL | `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` |
| Cadence | 3 hours |
| Cache TTL | 300 seconds |
| Auth | None |

Official planetary Kp index. Used as **reference data** (not as model input).
Displayed separately from simulation estimates.

## GOES X-ray Flux

| Property | Value |
|---|---|
| URL | `https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json` |
| Cadence | ~1 minute |
| Cache TTL | 120 seconds |
| Auth | None |

GOES-16/17 1-8 Å X-ray flux (W/m²). Used for flare detection and classification (A/B/C/M/X).

## NASA DONKI

| Property | Value |
|---|---|
| CME URL | `https://api.nasa.gov/DONKI/CME` |
| Flare URL | `https://api.nasa.gov/DONKI/FLR` |
| Cache TTL | 600 seconds |
| Auth | API key (default: `DEMO_KEY`) |

CME events with speed, half-angle, earth-direction. Flare events with source location and association.

## Quality Assessment

Each adapter assesses data quality based on:
- **Freshness**: time since most recent sample
- **Completeness**: ratio of non-null fields
- **Coverage**: temporal span of returned data

Quality flags: `fresh` | `delayed` | `sparse` | `interpolated` | `fallback`

## Degraded Mode

When an adapter fails:
- Panel shows "DEGRADED" badge
- Cached data used if available
- Fallback values used as last resort
- No silent hiding of missing data
