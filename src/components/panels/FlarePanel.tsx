import { DataCard } from '../common/DataCard';
import type { FlareEvent } from '../../domain/models';

interface Props {
  flares: FlareEvent[];
  isDegraded: boolean;
}

function getFlareColor(cls: string): string {
  switch (cls) {
    case 'X': return 'var(--kp-severe)';
    case 'M': return 'var(--kp-moderate)';
    case 'C': return 'var(--kp-minor)';
    case 'B': return 'var(--kp-active)';
    default: return 'var(--kp-quiet)';
  }
}

export function FlarePanel({ flares, isDegraded }: Props) {
  const source = flares.length > 0 ? flares[0].source : '—';
  const quality = flares.length > 0 ? flares[0].quality : 'fallback' as const;
  const sortedFlares = [...flares].sort(
    (a, b) => new Date(b.begin_time_utc).getTime() - new Date(a.begin_time_utc).getTime()
  ).slice(0, 10);

  return (
    <DataCard title="Solar Flare Activity" source={source} quality={quality} isDegraded={isDegraded}>
      {sortedFlares.length === 0 ? (
        <div className="empty-state">
          <span>No significant flares detected</span>
          <span className="text-xs">Background X-ray levels nominal</span>
        </div>
      ) : (
        <div className="alert-list">
          {sortedFlares.map((flare) => (
            <div key={flare.id} className="alert-item alert-item--info">
              <span style={{ color: getFlareColor(flare.flare_class), fontWeight: 600, fontFamily: 'var(--font-mono)', minWidth: '40px', fontSize: 'var(--text-sm)' }}>
                {flare.flare_class}{flare.class_magnitude?.toFixed(1) ?? ''}
              </span>
              <span style={{ flex: 1 }}>
                {new Date(flare.begin_time_utc).toUTCString().slice(5, 22)} UTC
                {flare.active_region && <span className="text-muted"> · AR {flare.active_region}</span>}
                {flare.source_lat_deg != null && flare.source_lon_deg != null && (
                  <span className="text-muted">
                    {' '}({flare.source_lat_deg > 0 ? 'N' : 'S'}{Math.abs(flare.source_lat_deg)}
                    {flare.source_lon_deg > 0 ? 'E' : 'W'}{Math.abs(flare.source_lon_deg)})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
}
