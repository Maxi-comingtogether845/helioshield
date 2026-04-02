import type { SolarWindSample } from '../../domain/models';
import { DataCard } from '../common/DataCard';

interface Props {
  data: SolarWindSample | null;
  isDegraded: boolean;
}

function MetricRow({ label, value, unit }: { label: string; value: string | null; unit: string }) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span>
        <span className="metric-value">{value ?? '—'}</span>
        <span className="metric-unit">{unit}</span>
      </span>
    </div>
  );
}

export function SolarWindPanel({ data, isDegraded }: Props) {
  if (!data) {
    return (
      <DataCard title="Solar Wind (L1)" source="—" quality="fallback" isDegraded={isDegraded}>
        <div className="empty-state">
          <span>No solar wind data available</span>
          <span className="text-xs">DSCOVR/ACE data feed may be offline</span>
        </div>
      </DataCard>
    );
  }

  return (
    <DataCard
      title="Solar Wind (L1)"
      source={data.source}
      quality={data.quality}
      timestamp={data.timestamp_utc}
      isDegraded={isDegraded}
      origin="simulation_estimate"
    >
      <MetricRow label="Speed (Vsw)" value={data.speed_km_s?.toFixed(0) ?? null} unit="km/s" />
      <MetricRow label="Density (Np)" value={data.density_p_cc?.toFixed(1) ?? null} unit="p/cm³" />
      <MetricRow label="IMF Bz" value={data.bz_nT?.toFixed(1) ?? null} unit="nT" />
      <MetricRow label="IMF Bt" value={data.bt_nT?.toFixed(1) ?? null} unit="nT" />
      <MetricRow label="IMF By" value={data.by_nT?.toFixed(1) ?? null} unit="nT" />
      <MetricRow label="Temperature" value={data.temperature_k ? (data.temperature_k / 1000).toFixed(0) : null} unit="kK" />

      {data.bz_nT != null && data.bz_nT < -5 && (
        <div className="alert-item alert-item--warning" style={{ marginTop: 'var(--sp-2)' }}>
          Sustained southward Bz ({data.bz_nT.toFixed(1)} nT) — enhanced geomagnetic coupling expected
        </div>
      )}
    </DataCard>
  );
}
