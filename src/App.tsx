import './index.css';
import { useState, useMemo, lazy, Suspense } from 'react';
import { useSpaceWeather } from './hooks/useSpaceWeather';
import { usePlayback } from './hooks/usePlayback';
import { useTimeSlicedData } from './hooks/useTimeSlicedData';
import { PlaybackBar } from './components/playback/PlaybackBar';
import { PresetSelector } from './components/presets/PresetSelector';
import { PRESETS, type PresetId } from './components/presets/HistoricalPresets';
import { TimeSeriesPanel } from './components/panels/TimeSeriesPanel';
import { SolarWindPanel } from './components/panels/SolarWindPanel';
import { KpGaugePanel } from './components/panels/KpGaugePanel';
import { ImpactPanel } from './components/panels/ImpactPanel';
import { FlarePanel } from './components/panels/FlarePanel';
import { CMEPanel } from './components/panels/CMEPanel';
import { AlertsPanel } from './components/panels/AlertsPanel';
import { MagnetosphereResponseEstimator } from './services/magnetosphere-response';
import type { MagnetosphereResult } from './services/magnetosphere-response';

const SunEarthScene = lazy(() =>
  import('./components/scene/SunEarthScene').then((m) => ({ default: m.SunEarthScene }))
);

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const magnetosphereEstimator = new MagnetosphereResponseEstimator();

function App() {
  const weatherData = useSpaceWeather();
  const playback = usePlayback();
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const [show3D, setShow3D] = useState(false);

  const effectiveData = useMemo(() => {
    if (!activePreset) return weatherData;
    const preset = PRESETS.find((p) => p.id === activePreset);
    if (!preset) return weatherData;

    const magnetosphereHistory: MagnetosphereResult[] = [];
    for (const sw of preset.solarWind) {
      const result = magnetosphereEstimator.estimate(sw);
      if (result) magnetosphereHistory.push(result);
    }

    return {
      ...weatherData,
      timeline: {
        solarWind: preset.solarWind,
        latestSolarWind: preset.solarWind[preset.solarWind.length - 1] ?? null,
        flares: preset.flares,
        cmes: preset.cmes,
        officialKp: preset.officialKp,
        degradedSources: [],
        overallQuality: 'fresh' as const,
      },
      magnetosphere: magnetosphereHistory.length > 0 ? magnetosphereHistory[magnetosphereHistory.length - 1] : null,
      magnetosphereHistory,
      propagations: [],
      impacts: null,
      overallQuality: 'fresh' as const,
      degradedSources: [] as string[],
      isLoading: false,
      error: null,
    };
  }, [activePreset, weatherData]);

  const sliced = useTimeSlicedData(effectiveData, playback.mode, playback.currentTime);
  const { overallQuality, degradedSources, lastUpdated, isLoading, error, refresh, timeline } = effectiveData;
  const isSourceDegraded = (src: string) => degradedSources.some((d) => d.toLowerCase().includes(src.toLowerCase()));

  return (
    <div className="app-container">
      <header className="app-header" role="banner">
        <div className="app-header__title">
          <h1>Helioshield</h1>
          <span className="subtitle">Space Weather</span>
        </div>
        <div className="app-header__status">
          <span className={`status-dot status-dot--${overallQuality}`} />
          <span className="text-xs text-secondary">{overallQuality}</span>
          <button className="header-btn" onClick={refresh} disabled={isLoading || activePreset !== null} aria-label="Refresh data">
            {isLoading ? '↻ Refreshing…' : '↻ Refresh'}
          </button>
          {!prefersReducedMotion && (
            <button
              className={`header-btn ${show3D ? 'header-btn--active' : ''}`}
              onClick={() => setShow3D((prev) => !prev)}
              aria-label={show3D ? 'Hide 3D scene' : 'Show 3D scene'}
            >
              3D {show3D ? 'On' : 'Off'}
            </button>
          )}
        </div>
      </header>

      <PlaybackBar {...playback} />
      <PresetSelector activePreset={activePreset} onSelectPreset={setActivePreset} />

      {activePreset && (
        <div className="alert-item alert-item--info" style={{ margin: '0 var(--sp-5)', borderRadius: 'var(--r-sm)' }}>
          Preset active: <strong>{PRESETS.find((p) => p.id === activePreset)?.label}</strong> —{' '}
          {PRESETS.find((p) => p.id === activePreset)?.description}.{' '}
          <button onClick={() => setActivePreset(null)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit' }}>
            Return to live data
          </button>
        </div>
      )}

      {error && !activePreset && (
        <div className="alert-item alert-item--danger" style={{ margin: 'var(--sp-2) var(--sp-5)', borderRadius: 'var(--r-sm)' }}>
          Pipeline error: {error}
        </div>
      )}

      {isLoading && !timeline && !activePreset && (
        <div className="dashboard-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="panel">
              <div className="loading-skeleton" style={{ height: '16px', width: '50%', marginBottom: '10px' }} />
              <div className="loading-skeleton" style={{ height: '100px' }} />
            </div>
          ))}
        </div>
      )}

      {timeline && (
        <main className="dashboard-grid" role="main">
          {show3D && !prefersReducedMotion && (
            <Suspense fallback={
              <div className="panel panel--span-2" style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-secondary text-xs">Loading 3D scene…</span>
              </div>
            }>
              <SunEarthScene
                solarWindSpeed={sliced.latestSolarWind?.speed_km_s ?? null}
                bzNt={sliced.latestSolarWind?.bz_nT ?? null}
                kpEstimate={sliced.magnetosphere?.kpEstimate ?? null}
              />
            </Suspense>
          )}

          <TimeSeriesPanel
            solarWind={sliced.solarWind}
            flares={sliced.flares}
            cmes={sliced.cmes}
            officialKp={sliced.officialKp}
            magnetosphereHistory={sliced.magnetosphereHistory}
            cursorTime={playback.currentTime}
            timeRange={playback.timeRange}
            isDegraded={isSourceDegraded('solar wind')}
          />

          <KpGaugePanel
            estimate={sliced.magnetosphere}
            official={sliced.officialKp.length > 0 ? sliced.officialKp[sliced.officialKp.length - 1] : null}
            isDegraded={isSourceDegraded('kp') && !sliced.magnetosphere}
          />

          <SolarWindPanel data={sliced.latestSolarWind} isDegraded={isSourceDegraded('solar wind')} />
          <ImpactPanel impacts={sliced.impacts} isDegraded={!sliced.magnetosphere} />
          <FlarePanel flares={sliced.flares} isDegraded={isSourceDegraded('xray') && isSourceDegraded('donki')} />
          <CMEPanel cmes={sliced.cmes} propagations={sliced.propagations} isDegraded={isSourceDegraded('donki')} />
          <AlertsPanel degradedSources={degradedSources} overallQuality={overallQuality} lastUpdated={lastUpdated} />
        </main>
      )}

      <footer className="disclaimer" role="contentinfo">
        All model outputs are simulation estimates for research and education. Not an official forecast.
        See <a href="https://www.swpc.noaa.gov" target="_blank" rel="noopener noreferrer">NOAA SWPC</a> for authoritative data.
        Official NOAA values shown separately as reference.
      </footer>
    </div>
  );
}

export default App;
