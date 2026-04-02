# Scientific Models

All model outputs are labeled **Simulation Estimate**. Official NOAA values are shown separately as reference.

## Newell Coupling Function (Kp Estimation)

Estimates the rate of magnetic flux opened at the magnetopause.

**Formula**: `dΦ/dt = v^(4/3) · Bt^(2/3) · sin^(8/3)(θc/2)`

Where:
- `v` = solar wind speed (km/s)
- `Bt` = transverse IMF magnitude (nT)
- `θc` = IMF clock angle = `atan2(By, Bz)` in GSM coordinates

**Kp calibration**: log-linear mapping from coupling function output, empirically tuned.

**Reference**: Newell, P.T., Sotirelis, T., Liou, K., Meng, C.-I., Rich, F.J. (2007). "A nearly universal solar wind-magnetosphere coupling function." *J. Geophys. Res.*, 112, A01206.

**Guards**: Singularity protection for `Bt → 0`, `v → 0`. Minimum coupling floor applied.

## Drag-Based Model (CME Propagation)

Estimates CME transit time from Sun to Earth using aerodynamic drag.

**Equation**: `dv/dt = -γ (v - w) |v - w|`

Where:
- `v` = CME speed
- `w` = ambient solar wind speed (default 400 km/s)
- `γ` = drag parameter (default 0.2 × 10⁻⁷ km⁻¹)

**Integration**: 4th-order Runge-Kutta (RK4) with 60-second time steps.

**Reference**: Vršnak, B., et al. (2013). "Propagation of interplanetary coronal mass ejections: The drag-based model." *Solar Phys.*, 285, 295-315.

**Confidence**: Heuristic based on initial speed range and solar wind quality.

## Aurora Boundary (Starkov Empirical)

Estimates equatorward boundary of auroral oval.

**Formula**: `lat = 67.5 - 2.5 × Kp` (simplified Starkov)

**Reference**: Starkov, G.V. (2008). "Statistical dependences of the auroral oval boundaries." *Geomag. Aeron.*, 48, 56-64.

## Impact Classification

Threshold-based scoring aligned with NOAA G-scale:

| Domain | Metric | Thresholds |
|---|---|---|
| Satellite drag | Kp | G1 (Kp≥5), G2 (≥6), G3 (≥7), G4 (≥8), G5 (≥9) |
| HF radio | Bz + Kp | Moderate (-10 nT), High (-20 nT + Kp≥7) |
| Power grid | Kp + dBz/dt | Moderate (Kp≥6), High (Kp≥8) |
| Aurora | Kp | Visible ≥3, Mid-latitude ≥5, Extreme ≥7 |
