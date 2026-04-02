/**
 * GlobalSim Helioshield — PlaybackBar
 *
 * Timeline controls: mode tabs, time scrubber, play/pause, speed selector.
 * Sits below the header and above the dashboard grid.
 */

import type { PlaybackMode, PlaybackSpeed, PlaybackControls, PlaybackState } from '../../hooks/usePlayback';

interface Props extends PlaybackState, PlaybackControls {}

const modeLabels: Record<PlaybackMode, string> = {
  live: '● LIVE',
  '24h': '24H',
  '7d': '7D',
};

const speeds: PlaybackSpeed[] = [1, 2, 4, 8];

function formatUTC(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function PlaybackBar(props: Props) {
  const {
    mode,
    currentTime,
    isPlaying,
    speed,
    timeRange,
    setMode,
    togglePlay,
    setSpeed,
    seekFraction,
    getFraction,
  } = props;

  const fraction = getFraction();
  const isPlaybackMode = mode !== 'live';

  return (
    <div className="playback-bar" role="toolbar" aria-label="Playback controls">
      {/* Mode tabs */}
      <div className="playback-bar__modes">
        {(Object.keys(modeLabels) as PlaybackMode[]).map((m) => (
          <button
            key={m}
            className={`playback-mode-btn ${mode === m ? 'playback-mode-btn--active' : ''} ${m === 'live' ? 'playback-mode-btn--live' : ''}`}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            aria-label={`Switch to ${m} mode`}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Time scrubber */}
      <div className="playback-bar__scrubber">
        <span className="playback-bar__time text-xs text-mono">
          {formatUTC(timeRange.start).slice(5, 16)}
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(fraction * 1000)}
          onChange={(e) => seekFraction(Number(e.target.value) / 1000)}
          className="playback-slider"
          disabled={!isPlaybackMode}
          aria-label="Time scrubber"
          aria-valuetext={formatUTC(currentTime)}
        />
        <span className="playback-bar__time text-xs text-mono">
          {formatUTC(timeRange.end).slice(5, 16)}
        </span>
      </div>

      {/* Current time display */}
      <div className="playback-bar__current-time text-sm text-mono">
        {formatUTC(currentTime)}
      </div>

      {/* Play/Pause + Speed */}
      <div className="playback-bar__controls">
        <button
          className="playback-btn"
          onClick={togglePlay}
          disabled={!isPlaybackMode}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="playback-speed-group">
          {speeds.map((s) => (
            <button
              key={s}
              className={`playback-speed-btn ${speed === s ? 'playback-speed-btn--active' : ''}`}
              onClick={() => setSpeed(s)}
              disabled={!isPlaybackMode}
              aria-label={`${s}x speed`}
              aria-pressed={speed === s}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
