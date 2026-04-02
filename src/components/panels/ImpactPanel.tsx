import { DataCard } from '../common/DataCard';
import type { ImpactAssessment } from '../../domain/models';
import type { RiskLevel } from '../../domain/enums';

interface Props {
  impacts: ImpactAssessment | null;
  isDegraded: boolean;
}

const riskLabels: Record<RiskLevel, string> = {
  none: 'None',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  severe: 'Severe',
};

const impactItems = [
  { key: 'aurora', riskField: 'aurora_risk' as const, title: 'Aurora Visibility', explainKey: 'aurora' },
  { key: 'satellite', riskField: 'satellite_drag_risk' as const, title: 'Satellite Drag', explainKey: 'satellite_drag' },
  { key: 'hf_radio', riskField: 'hf_radio_risk' as const, title: 'HF Radio', explainKey: 'hf_radio' },
  { key: 'power_grid', riskField: 'power_grid_risk' as const, title: 'Power Grid (GIC)', explainKey: 'power_grid' },
] as const;

export function ImpactPanel({ impacts, isDegraded }: Props) {
  if (!impacts) {
    return (
      <DataCard title="Impact Assessment" source="—" quality="fallback" isDegraded={isDegraded}>
        <div className="empty-state">
          <span>Awaiting data for impact scoring</span>
        </div>
      </DataCard>
    );
  }

  return (
    <DataCard
      title="Impact Assessment"
      source="Helioshield Impact Scorer"
      quality={impacts.quality}
      timestamp={impacts.timestamp_utc}
      isDegraded={isDegraded}
      origin="simulation_estimate"
    >
      <div className="impact-grid">
        {impactItems.map((item) => {
          const risk = impacts[item.riskField] as RiskLevel;
          const explanation = impacts.explanations[item.explainKey] ?? '';
          return (
            <div key={item.key} className={`impact-card impact-card--${risk}`}>
              <div className="impact-card__title">{item.title}</div>
              <div className="impact-card__level" style={{ color: riskToColor(risk) }}>
                {riskLabels[risk]}
              </div>
              <div className="impact-card__explanation">{explanation}</div>
            </div>
          );
        })}
      </div>

      {impacts.aurora_boundary_lat_deg && (
        <div className="metric-row" style={{ marginTop: 'var(--sp-2)' }}>
          <span className="metric-label">Aurora Equatorward Boundary</span>
          <span>
            <span className="metric-value">{impacts.aurora_boundary_lat_deg.toFixed(1)}</span>
            <span className="metric-unit">° geographic</span>
          </span>
        </div>
      )}
    </DataCard>
  );
}

function riskToColor(risk: RiskLevel): string {
  switch (risk) {
    case 'none': return 'var(--kp-quiet)';
    case 'low': return 'var(--kp-active)';
    case 'moderate': return 'var(--kp-moderate)';
    case 'high': return 'var(--kp-strong)';
    case 'severe': return 'var(--kp-severe)';
  }
}
