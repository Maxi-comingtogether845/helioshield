/**
 * GlobalSim Helioshield — Unit Conversion Utilities
 *
 * Isolates all unit and coordinate transformations in one place.
 * Every conversion function documents input/output units.
 */

import { SCIENTIFIC_CONSTANTS } from '../config/constants';

/**
 * Convert km to AU.
 * Input: km, Output: AU
 */
export function kmToAU(km: number): number {
  return km / SCIENTIFIC_CONSTANTS.AU_KM;
}

/**
 * Convert AU to km.
 * Input: AU, Output: km
 */
export function auToKm(au: number): number {
  return au * SCIENTIFIC_CONSTANTS.AU_KM;
}

/**
 * Convert nT to Tesla.
 * Input: nT, Output: T
 */
export function nTtoTesla(nT: number): number {
  return nT * 1e-9;
}

/**
 * Convert km/s to m/s.
 */
export function kmsToMs(kmPerSec: number): number {
  return kmPerSec * 1000;
}

/**
 * Convert seconds to hours.
 */
export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

/**
 * Convert seconds to days.
 */
export function secondsToDays(seconds: number): number {
  return seconds / 86400;
}

/**
 * Compute solar wind dynamic pressure proxy.
 *
 * P_dyn = m_p × Np × Vsw²
 *
 * Input: Np in particles/cm³, Vsw in km/s
 * Output: nPa (nanopascals)
 *
 * Unit derivation:
 *   m_p = 1.6726e-27 kg
 *   Np: 1/cm³ = 1e6/m³
 *   Vsw: 1 km/s = 1e3 m/s
 *   P = m_p × (Np × 1e6) × (Vsw × 1e3)² [Pa]
 *   P = m_p × Np × Vsw² × 1e6 × 1e6 [Pa]
 *   P = m_p × Np × Vsw² × 1e12 [Pa]
 *   P_nPa = m_p × Np × Vsw² × 1e12 × 1e9 [nPa]
 *   P_nPa = m_p × Np × Vsw² × 1e21 [nPa]
 *
 * Simplified coefficient: 1.6726e-27 × 1e21 = 1.6726e-6
 */
export function dynamicPressure_nPa(densityPerCc: number, speedKmS: number): number {
  return 1.6726e-6 * densityPerCc * speedKmS * speedKmS;
}

/**
 * Convert geomagnetic latitude to approximate geographic latitude.
 *
 * Uses centered dipole approximation.
 * The dipole pole is at approximately 80.65°N geographic.
 *
 * For a given geomagnetic latitude λ_m, the approximate geographic
 * latitude on the midnight meridian is:
 *   λ_geo ≈ λ_m + (90 - DIPOLE_POLE_LAT)
 *
 * This is a ~first-order approximation valid ±3° at mid-latitudes.
 * For v1, this is sufficient. Full AACGM conversion would require
 * the IGRF model.
 *
 * Input: geomagnetic latitude (degrees)
 * Output: geographic latitude (degrees)
 */
export function geomagToGeographic(geomagLatDeg: number): number {
  const offset = 90 - SCIENTIFIC_CONSTANTS.DIPOLE_POLE_LAT_DEG;
  return geomagLatDeg - offset;
}

/**
 * Classify GOES X-ray flux in W/m² to flare class string.
 *
 * Input: flux in W/m² (1–8 Å band)
 * Output: Flare class letter + magnitude, e.g. "M2.3"
 */
export function classifyFlareFlux(fluxWm2: number): { cls: string; magnitude: number } {
  if (fluxWm2 >= 1e-4) {
    return { cls: 'X', magnitude: fluxWm2 / 1e-4 };
  } else if (fluxWm2 >= 1e-5) {
    return { cls: 'M', magnitude: fluxWm2 / 1e-5 };
  } else if (fluxWm2 >= 1e-6) {
    return { cls: 'C', magnitude: fluxWm2 / 1e-6 };
  } else if (fluxWm2 >= 1e-7) {
    return { cls: 'B', magnitude: fluxWm2 / 1e-7 };
  } else {
    return { cls: 'A', magnitude: fluxWm2 / 1e-8 };
  }
}
