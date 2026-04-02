/**
 * GlobalSim Helioshield — Preset Selector UI
 *
 * Dropdown for loading historical event presets:
 *   - Quiet Period
 *   - Moderate Storm
 *   - Strong CME
 *
 * When active, overrides live data in all panels.
 */

import { PRESETS, type PresetId } from './HistoricalPresets';

interface Props {
  activePreset: PresetId | null;
  onSelectPreset: (id: PresetId | null) => void;
}

export function PresetSelector({ activePreset, onSelectPreset }: Props) {
  return (
    <div className="preset-selector">
      <button
        className={`preset-btn ${activePreset === null ? 'preset-btn--active' : ''}`}
        onClick={() => onSelectPreset(null)}
        title="Use live or ingested data"
      >
        📡 Live Data
      </button>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          className={`preset-btn ${activePreset === p.id ? 'preset-btn--active' : ''}`}
          onClick={() => onSelectPreset(p.id)}
          title={p.description}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
