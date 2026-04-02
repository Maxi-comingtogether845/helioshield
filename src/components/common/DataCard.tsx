import React from 'react';
import type { DataQuality } from '../../domain/enums';
import { relativeTime } from '../../lib/time';

interface DataCardProps {
  title: string;
  source: string;
  quality: DataQuality;
  timestamp?: string | null;
  isDegraded?: boolean;
  origin?: 'simulation_estimate' | 'official_reference';
  children: React.ReactNode;
}

const qualityColors: Record<DataQuality, string> = {
  fresh: 'var(--q-fresh)',
  delayed: 'var(--q-delayed)',
  sparse: 'var(--q-sparse)',
  interpolated: 'var(--q-interpolated)',
  fallback: 'var(--q-fallback)',
};

export function DataCard({
  title,
  source,
  quality,
  timestamp,
  isDegraded,
  origin,
  children,
}: DataCardProps) {
  return (
    <div
      className={`panel ${isDegraded ? 'panel--degraded' : ''}`}
      role="region"
      aria-label={title}
    >
      <div className="panel__header">
        <h2 className="panel__title">{title}</h2>
        <div className="panel__meta">
          {origin && (
            <span className={`badge ${origin === 'simulation_estimate' ? 'badge--simulation' : 'badge--official'}`}>
              {origin === 'simulation_estimate' ? 'Simulation Estimate' : 'Official NOAA Reference'}
            </span>
          )}
          <span className="badge badge--quality" style={{ color: qualityColors[quality] }}>
            <span className={`status-dot status-dot--${quality}`} aria-hidden="true" />
            {quality}
          </span>
        </div>
      </div>

      <div className="panel__body">{children}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-2)' }}>
        <span className="text-xs text-muted" title={source}>{source}</span>
        {timestamp && (
          <span className="text-xs text-muted" title={timestamp}>{relativeTime(timestamp)}</span>
        )}
      </div>
    </div>
  );
}
