/**
 * GlobalSim Helioshield — TimeSeriesChart
 *
 * Reusable SVG line chart with:
 *   - Gap-aware rendering (null values → visible line breaks)
 *   - Dual-series support (simulation vs official reference)
 *   - Event markers (flares + CMEs)
 *   - Playback cursor
 *   - Responsive width
 *
 * No external charting library — full control over sparse data rendering.
 */

import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';

export interface ChartDataPoint {
  timestamp: string;
  value: number | null;
}

export interface ChartSeries {
  id: string;
  label: string;
  data: ChartDataPoint[];
  color: string;
  /** Render as step function (for official Kp) */
  step?: boolean;
  /** Dashed line style */
  dashed?: boolean;
}

export interface EventMarker {
  timestamp: string;
  label: string;
  color: string;
  type: 'flare' | 'cme';
}

interface Props {
  series: ChartSeries[];
  eventMarkers?: EventMarker[];
  /** Playback cursor timestamp */
  cursorTime?: string;
  /** Y-axis label */
  yLabel: string;
  /** Y-axis range (auto if not provided) */
  yRange?: [number, number];
  /** Chart height in px */
  height?: number;
  /** Time range for X-axis */
  timeRange: { start: string; end: string };
}

const PADDING = { top: 8, right: 12, bottom: 20, left: 48 };

/**
 * Build SVG path segments with gap handling.
 * Null values break the line; gaps are shown as empty space.
 */
function buildPathSegments(
  data: ChartDataPoint[],
  xScale: (ts: string) => number,
  yScale: (v: number) => number,
  step: boolean
): string[] {
  const segments: string[] = [];
  let currentPath = '';

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    if (point.value === null) {
      if (currentPath) {
        segments.push(currentPath);
        currentPath = '';
      }
      continue;
    }

    const x = xScale(point.timestamp);
    const y = yScale(point.value);

    if (!currentPath) {
      currentPath = `M ${x} ${y}`;
    } else {
      if (step) {
        // Step function: horizontal then vertical
        const prevX = xScale(data[i - 1]?.timestamp ?? point.timestamp);
        currentPath += ` L ${x} ${yScale(data[i - 1]?.value ?? point.value)} L ${x} ${y}`;
      } else {
        currentPath += ` L ${x} ${y}`;
      }
    }
  }

  if (currentPath) segments.push(currentPath);
  return segments;
}

export function TimeSeriesChart({
  series,
  eventMarkers = [],
  cursorTime,
  yLabel,
  yRange,
  height = 90,
  timeRange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  // Responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  // X scale: timestamp → pixels
  const startMs = new Date(timeRange.start).getTime();
  const endMs = new Date(timeRange.end).getTime();
  const rangeMs = Math.max(endMs - startMs, 1);

  const xScale = useCallback(
    (ts: string) => PADDING.left + ((new Date(ts).getTime() - startMs) / rangeMs) * chartWidth,
    [startMs, rangeMs, chartWidth]
  );

  // Y scale: value → pixels (inverted)
  const allValues = series
    .flatMap((s) => s.data.map((d) => d.value))
    .filter((v): v is number => v !== null);

  const [yMin, yMax] = yRange ?? [
    allValues.length > 0 ? Math.min(...allValues) : 0,
    allValues.length > 0 ? Math.max(...allValues) : 1,
  ];
  const ySpan = Math.max(yMax - yMin, 0.01);

  const yScale = useCallback(
    (v: number) => PADDING.top + chartHeight - ((v - yMin) / ySpan) * chartHeight,
    [yMin, ySpan, chartHeight]
  );

  // Y-axis tick marks (3 ticks)
  const yTicks = [yMin, yMin + ySpan / 2, yMax];

  // X-axis time ticks (5 ticks) — show date for multi-day ranges
  const showDate = rangeMs > 2 * 86400_000; // > 2 days
  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const t = startMs + (i / 4) * rangeMs;
    return new Date(t).toISOString();
  });

  // Memoize path segments to avoid recomputation when only cursor changes
  const seriesPaths = useMemo(() => {
    return series.map((s) => ({
      id: s.id,
      color: s.color,
      dashed: s.dashed,
      segments: buildPathSegments(s.data, xScale, yScale, !!s.step),
    }));
  }, [series, xScale, yScale]);

  return (
    <div ref={containerRef} className="chart-container">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label={`${yLabel} time series chart`}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={`yg-${i}`}
            x1={PADDING.left}
            y1={yScale(tick)}
            x2={width - PADDING.right}
            y2={yScale(tick)}
            className="chart-grid"
          />
        ))}

        {/* Event markers */}
        {eventMarkers.map((marker, i) => {
          const x = xScale(marker.timestamp);
          if (x < PADDING.left || x > width - PADDING.right) return null;
          return (
            <g key={`em-${i}`}>
              <line
                x1={x}
                y1={PADDING.top}
                x2={x}
                y2={height - PADDING.bottom}
                stroke={marker.color}
                strokeWidth={1}
                strokeDasharray={marker.type === 'cme' ? '4,3' : '2,2'}
                opacity={0.6}
              />
              <text
                x={x + 2}
                y={PADDING.top + 10}
                className="chart-marker-label"
                fill={marker.color}
              >
                {marker.label}
              </text>
            </g>
          );
        })}

        {/* Data series (memoized) */}
        {seriesPaths.map((sp) =>
          sp.segments.map((path, i) => (
            <path
              key={`${sp.id}-${i}`}
              d={path}
              fill="none"
              stroke={sp.color}
              strokeWidth={1.5}
              strokeDasharray={sp.dashed ? '6,3' : undefined}
              opacity={0.9}
            />
          ))
        )}

        {/* Playback cursor */}
        {cursorTime && (
          <line
            x1={xScale(cursorTime)}
            y1={PADDING.top}
            x2={xScale(cursorTime)}
            y2={height - PADDING.bottom}
            className="chart-cursor"
          />
        )}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={`yt-${i}`}
            x={PADDING.left - 4}
            y={yScale(tick) + 3}
            className="chart-tick-label"
            textAnchor="end"
          >
            {tick >= 1000 ? (tick / 1000).toFixed(0) + 'k' : tick.toFixed(tick < 10 ? 1 : 0)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={`xt-${i}`}
            x={xScale(tick)}
            y={height - 4}
            className="chart-tick-label"
            textAnchor="middle"
          >
            {showDate
              ? new Date(tick).toISOString().slice(5, 10) + ' ' + new Date(tick).toISOString().slice(11, 16)
              : new Date(tick).toISOString().slice(11, 16)
            }
          </text>
        ))}

        {/* Y-axis label */}
        <text
          x={12}
          y={PADDING.top + chartHeight / 2}
          className="chart-axis-label"
          textAnchor="middle"
          transform={`rotate(-90, 12, ${PADDING.top + chartHeight / 2})`}
        >
          {yLabel}
        </text>
      </svg>

      {/* Legend */}
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.id} className="chart-legend-item">
            <span
              className="chart-legend-color"
              style={{
                background: s.color,
                borderRadius: s.dashed ? 0 : '50%',
                borderBottom: s.dashed ? `2px dashed ${s.color}` : undefined,
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const MemoizedTimeSeriesChart = memo(TimeSeriesChart);
