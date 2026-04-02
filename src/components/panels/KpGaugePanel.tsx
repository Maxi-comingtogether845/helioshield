import { DataCard } from '../common/DataCard';
import type { MagnetosphereResult } from '../../services/magnetosphere-response';
import type { GeomagneticIndexSample } from '../../domain/models';

interface Props {
  estimate: MagnetosphereResult | null;
  official: GeomagneticIndexSample | null;
  isDegraded: boolean;
}

const stormPhaseLabels: Record<string, string> = {
  quiet: 'Quiet',
  active: 'Active',
  minor_storm: 'G1 Minor Storm',
  moderate_storm: 'G2 Moderate Storm',
  strong_storm: 'G3 Strong Storm',
  severe_storm: 'G4 Severe Storm',
  extreme_storm: 'G5 Extreme Storm',
};

function getKpColor(kp: number): string {
  if (kp >= 9) return 'var(--kp-extreme)';
  if (kp >= 8) return 'var(--kp-severe)';
  if (kp >= 7) return 'var(--kp-strong)';
  if (kp >= 6) return 'var(--kp-moderate)';
  if (kp >= 5) return 'var(--kp-minor)';
  if (kp >= 4) return 'var(--kp-active)';
  return 'var(--kp-quiet)';
}

export function KpGaugePanel({ estimate, official, isDegraded }: Props) {
  const kp = estimate?.kpEstimate ?? 0;
  const phase = estimate?.stormPhase ?? 'quiet';
  const offKp = official?.kp ?? null;

  return (
    <DataCard
      title="Geomagnetic Activity"
      source={estimate?.sample.source ?? '—'}
      quality={estimate?.sample.quality ?? 'fallback'}
      timestamp={estimate?.sample.timestamp_utc}
      isDegraded={isDegraded}
    >
      <div className="kp-gauge">
        <div className="kp-gauge__label">Kp Index</div>
        <div className="kp-gauge__value" style={{ color: getKpColor(kp) }}>
          {kp.toFixed(1)}
        </div>
        <div className="kp-gauge__bar" role="progressbar" aria-valuenow={kp} aria-valuemin={0} aria-valuemax={9}>
          <div
            className="kp-gauge__fill"
            style={{
              width: `${(kp / 9) * 100}%`,
              background: `linear-gradient(90deg, var(--kp-quiet), ${getKpColor(kp)})`,
            }}
          />
        </div>
        <div className="kp-gauge__label">{stormPhaseLabels[phase]}</div>
        <span className="badge badge--simulation">Simulation Estimate</span>
      </div>

      {offKp != null && (
        <div style={{ marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-xs text-secondary">NOAA Official Kp</span>
            <span className="badge badge--official">Official NOAA Reference</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', marginTop: '3px' }}>
            <span className="metric-value" style={{ color: getKpColor(offKp), fontSize: 'var(--text-md)' }}>
              {offKp.toFixed(0)}
            </span>
            <span className="text-xs text-muted">
              {stormPhaseLabels[official?.storm_phase ?? 'quiet']}
            </span>
          </div>
        </div>
      )}

      {estimate?.explanation && (
        <div className="text-xs text-muted" style={{ marginTop: 'var(--sp-2)', lineHeight: 1.5 }}>
          {estimate.explanation}
        </div>
      )}
    </DataCard>
  );
}
