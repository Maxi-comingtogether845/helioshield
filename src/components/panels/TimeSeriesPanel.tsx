/**
 * GlobalSim Helioshield — TimeSeriesPanel
 *
 * Stacked mini-charts for key space weather parameters:
 *   1. Solar wind speed (Vsw)
 *   2. Proton density (Np)
 *   3. IMF Bz (with 0-line reference)
 *   4. IMF Bt
 *   5. Simulation Kp estimate (blue solid)
 *   6. NOAA official Kp reference (green dashed step)
 *
 * All charts are synchronized to the same time range and cursor.
 */

import { MemoizedTimeSeriesChart as TimeSeriesChart, type ChartSeries, type EventMarker, type ChartDataPoint } from '../charts/TimeSeriesChart';
import type { SolarWindSample, FlareEvent, CMEEvent, GeomagneticIndexSample } from '../../domain/models';
import type { MagnetosphereResult } from '../../services/magnetosphere-response';

interface Props {
  solarWind: SolarWindSample[];
  flares: FlareEvent[];
  cmes: CMEEvent[];
  officialKp: GeomagneticIndexSample[];
  magnetosphereHistory: MagnetosphereResult[];
  cursorTime: string;
  timeRange: { start: string; end: string };
  isDegraded: boolean;
}

/** Build event markers from flares and CMEs */
function buildEventMarkers(flares: FlareEvent[], cmes: CMEEvent[]): EventMarker[] {
  const markers: EventMarker[] = [];

  for (const f of flares) {
    const time = f.peak_time_utc ?? f.begin_time_utc;
    const flareColorMap: Record<string, string> = {
      X: '#a8413b',
      M: '#c87a4a',
      C: '#d4a04a',
      B: '#b8a640',
      A: '#4caf7c',
    };
    markers.push({
      timestamp: time,
      label: `${f.flare_class}${f.class_magnitude?.toFixed(1) ?? ''}`,
      color: flareColorMap[f.flare_class] ?? '#545862',
      type: 'flare',
    });
  }

  for (const c of cmes) {
    markers.push({
      timestamp: c.start_time_utc,
      label: `CME ${c.speed_km_s ?? '?'} km/s`,
      color: '#d4a04a',
      type: 'cme',
    });
  }

  // Cap markers to avoid clutter in dense 7D windows
  if (markers.length > 20) {
    // Keep only flares >= M-class and all CMEs; if still too many, take most recent 20
    const significant = markers.filter(
      (m) => m.type === 'cme' || (m.type === 'flare' && (m.label.startsWith('X') || m.label.startsWith('M')))
    );
    return significant.length > 20 ? significant.slice(-20) : significant;
  }
  return markers;
}

/** Convert solar wind array to chart data points for a specific field */
function swToPoints(sw: SolarWindSample[], field: keyof SolarWindSample): ChartDataPoint[] {
  return sw.map((s) => ({
    timestamp: s.timestamp_utc,
    value: s[field] as number | null,
  }));
}

export function TimeSeriesPanel({
  solarWind,
  flares,
  cmes,
  officialKp,
  magnetosphereHistory,
  cursorTime,
  timeRange,
  isDegraded,
}: Props) {
  const eventMarkers = buildEventMarkers(flares, cmes);

  // Kp simulation series
  const simKpData: ChartDataPoint[] = magnetosphereHistory.map((m) => ({
    timestamp: m.sample.timestamp_utc,
    value: m.kpEstimate,
  }));

  // Official Kp reference series
  const offKpData: ChartDataPoint[] = officialKp.map((k) => ({
    timestamp: k.timestamp_utc,
    value: k.kp,
  }));

  const charts: Array<{
    key: string;
    yLabel: string;
    series: ChartSeries[];
    yRange?: [number, number];
  }> = [
    {
      key: 'vsw',
      yLabel: 'km/s',
      series: [
        {
          id: 'vsw',
          label: 'Solar Wind Speed',
          data: swToPoints(solarWind, 'speed_km_s'),
          color: '#5b9bd5',
        },
      ],
    },
    {
      key: 'np',
      yLabel: 'p/cm³',
      series: [
        {
          id: 'np',
          label: 'Proton Density',
          data: swToPoints(solarWind, 'density_p_cc'),
          color: '#4caf7c',
        },
      ],
    },
    {
      key: 'bz',
      yLabel: 'nT',
      series: [
        {
          id: 'bz',
          label: 'IMF Bz (GSM)',
          data: swToPoints(solarWind, 'bz_nT'),
          color: '#c65d57',
        },
      ],
    },
    {
      key: 'bt',
      yLabel: 'nT',
      series: [
        {
          id: 'bt',
          label: 'IMF Bt',
          data: swToPoints(solarWind, 'bt_nT'),
          color: '#8a6cbf',
        },
      ],
    },
    {
      key: 'kp',
      yLabel: 'Kp',
      yRange: [0, 9] as [number, number],
      series: [
        {
          id: 'sim-kp',
          label: 'Simulation Kp',
          data: simKpData,
          color: '#5b9bd5',
        },
        {
          id: 'off-kp',
          label: 'Official NOAA Kp',
          data: offKpData,
          color: '#4caf7c',
          step: true,
          dashed: true,
        },
      ],
    },
  ];

  return (
    <div
      className={`panel panel--span-2 ${isDegraded ? 'panel--degraded' : ''}`}
      role="region"
      aria-label="Time Series Charts"
      style={{ position: 'relative' }}
    >
      <div className="panel__header">
        <h2 className="panel__title">Time Series</h2>
        <div className="panel__meta">
          <span className="badge badge--simulation">Simulation Estimate</span>
          <span className="badge badge--official">Official NOAA Reference</span>
        </div>
      </div>
      <div className="panel__body" style={{ gap: 0 }}>
        {charts.map((chart) => (
          <TimeSeriesChart
            key={chart.key}
            series={chart.series}
            eventMarkers={eventMarkers}
            cursorTime={cursorTime}
            yLabel={chart.yLabel}
            yRange={chart.yRange}
            height={90}
            timeRange={timeRange}
          />
        ))}
      </div>
    </div>
  );
}
