# Validation

## Test Suite

128 tests across 5 test files. Run with `npm test`.

| File | Tests | Coverage |
|---|---|---|
| `domain-models.test.ts` | 16 | Zod schema validation, null handling, bounds |
| `utils.test.ts` | 40 | RK4 integrator, time parsing, unit conversions, TTL cache |
| `adapters.test.ts` | 18 | All 4 adapters with 3 fixture scenarios |
| `scientific-core.test.ts` | 36 | DBM transit, Newell coupling, Kp calibration, aurora boundary, impact scoring |
| `playback.test.ts` | 18 | Time slicing, scrubbing, speed controls, sparse data rendering |

## Mock Fixtures

Three predefined scenarios in `src/__tests__/fixtures/`:
- `quiet-period.json` — solar minimum conditions
- `moderate-storm.json` — Kp 5-6 event
- `strong-cme.json` — fast halo CME + X-class flare

## Scientific Validation

| Model | Validated Against |
|---|---|
| Newell coupling | Monotonicity with increasing Bz southward and speed |
| DBM transit | Fast CME (1500 km/s) < 30h, slow CME (500 km/s) > 60h |
| Aurora boundary | Kp 0 → ~67.5°, Kp 9 → ~45° |
| Impact scoring | Threshold bands match NOAA G-scale |

## Smoke Test

Run `npm run smoke` against the preview server to validate:
- HTML structure and SEO tags
- CSS design tokens present, old tokens removed
- JS bundle loads without debug logs
- 3D chunk is lazy-loaded (separate file)

## Production Build

Run `npm run build` to verify:
- TypeScript strict mode (0 errors)
- Vite production bundle (optimized, tree-shaken)
- Main chunk: ~94 kB gzip
- 3D chunk: ~285 kB gzip (lazy-loaded)
