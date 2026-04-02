import { DataCard } from '../common/DataCard';
import type { CMEEvent } from '../../domain/models';
import type { PropagationResult } from '../../services/propagation-estimator';

interface Props {
  cmes: CMEEvent[];
  propagations: PropagationResult[];
  isDegraded: boolean;
}

export function CMEPanel({ cmes, propagations, isDegraded }: Props) {
  const source = cmes.length > 0 ? cmes[0].source : '—';
  const quality = cmes.length > 0 ? cmes[0].quality : 'fallback' as const;
  const propMap = new Map(propagations.map((p) => [p.cmeId, p]));

  const sorted = [...cmes].sort(
    (a, b) => new Date(b.start_time_utc).getTime() - new Date(a.start_time_utc).getTime()
  ).slice(0, 8);

  return (
    <DataCard title="CME Events" source={source} quality={quality} isDegraded={isDegraded}>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <span>No recent CME events</span>
          <span className="text-xs">Quiet heliospheric conditions</span>
        </div>
      ) : (
        <div className="alert-list">
          {sorted.map((cme) => {
            const prop = propMap.get(cme.id);
            return (
              <div
                key={cme.id}
                className={`alert-item ${cme.is_earth_directed ? 'alert-item--warning' : 'alert-item--info'}`}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {cme.is_earth_directed ? 'Earth-directed' : 'Non-Earth-directed'}
                    </span>
                    {cme.speed_km_s && (
                      <span className="text-mono text-xs">{cme.speed_km_s} km/s</span>
                    )}
                    {cme.half_angle_deg && (
                      <span className="text-xs text-muted">{cme.half_angle_deg}° half-angle</span>
                    )}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
                    {new Date(cme.start_time_utc).toUTCString().slice(5, 22)} UTC
                  </div>
                  {prop && (
                    <div style={{ marginTop: '4px', padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 'var(--r-sm)' }}>
                      <span className="badge badge--simulation">Simulation Estimate</span>
                      <span className="text-xs" style={{ marginLeft: '6px' }}>
                        Transit: {prop.transitTimeHours.toFixed(1)}h · ~{prop.arrivalSpeedKmS} km/s at Earth
                      </span>
                      <div className="text-xs text-muted">
                        ETA: {new Date(prop.estimatedArrivalUtc).toUTCString().slice(5, 22)} UTC
                        {' '}(confidence: {(prop.confidence * 100).toFixed(0)}%)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DataCard>
  );
}
