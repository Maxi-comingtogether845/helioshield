# Helioshield

Research-grade space weather simulation dashboard. Ingests real-time NOAA/NASA data and visualizes heliospheric conditions, geomagnetic response, and terrestrial impacts.

> **All model outputs are Simulation Estimates for research and education. Not an official forecast.**
> Official NOAA data is displayed separately as reference.

## Features

- **Solar wind monitoring** — speed, density, IMF Bz/Bt from DSCOVR/ACE via NOAA SWPC
- **Geomagnetic Kp estimation** — Newell coupling function with log-linear calibration
- **Impact assessment** — aurora boundary, satellite drag, HF radio, power grid (GIC)
- **CME propagation** — drag-based model (DBM) with RK4 integration
- **Flare detection** — GOES X-ray flux classification and DONKI event correlation
- **Playback mode** — past 24h and 7-day historical playback with synchronized panels
- **Historical presets** — quiet period, moderate storm, strong CME scenarios
- **Optional 3D scene** — lazy-loaded Sun-Earth-L1 visualization (Three.js)

## Quick Start

```bash
npm install
npm run dev          # Development server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm test             # Run test suite (128 tests)
npm run smoke        # Run automated smoke test against preview server
```

## Architecture

Fully client-side. No backend, no proxy, no server.

```
src/
├── config/           # Constants, thresholds, data source configs
├── domain/           # Zod-validated models, enums
├── lib/              # Math (RK4), time, units, cache, retry
├── services/
│   ├── adapters/     # NOAA Solar Wind, Kp, GOES X-ray, NASA DONKI
│   ├── ingest-service.ts
│   ├── event-fusion-engine.ts
│   ├── propagation-estimator.ts
│   ├── magnetosphere-response.ts
│   └── impact-scorer.ts
├── hooks/            # useSpaceWeather, usePlayback, useTimeSlicedData
├── components/
│   ├── panels/       # SolarWind, Kp, Impact, Flare, CME, Alerts, TimeSeries
│   ├── charts/       # Custom SVG TimeSeriesChart
│   ├── playback/     # PlaybackBar
│   ├── presets/      # PresetSelector, HistoricalPresets
│   ├── scene/        # 3D SunEarthScene (lazy-loaded)
│   └── common/       # DataCard
└── __tests__/        # 128 unit/integration tests, 3 mock fixtures
```

## Data Sources

| Source | Endpoint | Data |
|---|---|---|
| NOAA SWPC Plasma | `services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json` | Solar wind speed, density, temperature |
| NOAA SWPC Mag | `services.swpc.noaa.gov/products/solar-wind/mag-7-day.json` | IMF Bx, By, Bz, Bt |
| NOAA SWPC Kp | `services.swpc.noaa.gov/products/noaa-planetary-k-index.json` | Official Kp index |
| GOES X-ray | `services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json` | X-ray flux, flare detection |
| NASA DONKI | `api.nasa.gov/DONKI/` | CME events, flare associations |

## Data Quality

Every data point carries a quality flag:
- `fresh` — received within expected cadence
- `delayed` — received but older than expected
- `sparse` — significant gaps in time series
- `interpolated` — filled by interpolation (labeled)
- `fallback` — using cached/default values

Panels display degraded state when one or more APIs fail.

## Scientific Models

| Model | Method | Reference |
|---|---|---|
| Kp estimation | Newell coupling function (dΦ/dt) | Newell et al. 2007 |
| CME transit | Drag-based model (DBM) with RK4 | Vršnak et al. 2013 |
| Aurora boundary | Starkov empirical formula | Starkov 2008 |
| Impact scoring | Threshold classification | NOAA G-scale |

## Playback

- Live mode with 60-second auto-refresh
- Past 24h and 7-day historical modes
- Time scrubber, play/pause, speed controls (1×, 2×, 4×, 8×)
- All panels synchronized to the cursor timestamp
- Time-series charts with gap-aware rendering for sparse data

## Historical Presets

Demonstrate the dashboard with predefined scenarios:
- **Quiet Period** — solar minimum, Vsw ~350 km/s, Bz northward
- **Moderate Storm** — Kp 5-6, sustained southward Bz -10 nT
- **Strong CME** — fast halo CME, X2.3 flare, Kp 7-9, Bz -35 nT

## 3D Scene

Optional, toggleable, lazy-loaded Three.js visualization:
- Sun with emissive glow
- Earth with Kp-reactive aurora halo
- L1/DSCOVR marker
- Solar wind particle flow (speed/color mapped)
- IMF Bz directional arrow
- Not to scale — distances compressed for clarity
- Disabled when `prefers-reduced-motion` is active

## Known Limitations

- **THREE.Clock deprecation warning**: Comes from `@react-three/fiber` internals. Cannot fix without upstream library update.
- **WebGL Context Lost** (dev only): May occur during hot-module replacement when toggling 3D rapidly. Mitigated with debounced mount. Does not appear in production.
- **3D scene chunk size**: Three.js lazy chunk is ~285 kB gzip. Only loaded when user enables 3D.
- **Model accuracy**: All outputs are research-grade simulation estimates. Not validated against operational forecasts.
- **CORS**: Some NOAA endpoints may require CORS. Dashboard degrades gracefully with fallback data.

## Tech Stack

- React 19 + TypeScript (strict)
- Vite 8
- Zod (runtime validation)
- Vitest (testing)
- Three.js / React Three Fiber (optional 3D)
- Custom SVG charts (no charting library)

## License

MIT
