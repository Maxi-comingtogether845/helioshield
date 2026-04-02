import type { DataQuality } from '../../domain/enums';

interface Props {
  degradedSources: string[];
  overallQuality: DataQuality;
  lastUpdated: string | null;
}

export function AlertsPanel({ degradedSources, overallQuality, lastUpdated }: Props) {
  return (
    <div className="panel">
      <div className="panel__header">
        <h2 className="panel__title">System Status</h2>
        <span className="badge badge--quality">
          <span className={`status-dot status-dot--${overallQuality}`} />
          {overallQuality}
        </span>
      </div>
      <div className="panel__body">
        {degradedSources.length > 0 ? (
          <div className="alert-list">
            {degradedSources.map((src) => (
              <div key={src} className="alert-item alert-item--warning">
                <strong>{src}</strong> — data source degraded or unavailable. Using cached/fallback data.
              </div>
            ))}
          </div>
        ) : (
          <div className="alert-item alert-item--success">
            All data sources operational
          </div>
        )}

        {lastUpdated && (
          <div className="text-xs text-muted" style={{ marginTop: 'auto', paddingTop: 'var(--sp-2)' }}>
            Last pipeline refresh: {new Date(lastUpdated).toUTCString()}
          </div>
        )}

        <div className="alert-item alert-item--info" style={{ marginTop: 'var(--sp-2)' }}>
          This is a <strong>research-grade simulation</strong>. Model outputs are labeled as Simulation Estimates.
          Official NOAA data is shown separately as reference.
        </div>
      </div>
    </div>
  );
}
