/**
 * GlobalSim Helioshield — usePlayback Hook
 *
 * Playback state machine for temporal navigation.
 *
 * Modes:
 *   - live: real-time data, auto-refreshes
 *   - 24h: past 24 hours window, scrubbable
 *   - 7d: past 7 days window, scrubbable
 *
 * Uses requestAnimationFrame for smooth playback animation.
 * Speed multiplier controls how fast time advances relative to real time.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type PlaybackMode = 'live' | '24h' | '7d';
export type PlaybackSpeed = 1 | 2 | 4 | 8;

export interface PlaybackState {
  mode: PlaybackMode;
  /** Current cursor position (ISO 8601 UTC) */
  currentTime: string;
  /** Is playback animation running? */
  isPlaying: boolean;
  /** Playback speed multiplier */
  speed: PlaybackSpeed;
  /** Time range { start, end } for the selected mode */
  timeRange: { start: string; end: string };
}

export interface PlaybackControls {
  setMode: (mode: PlaybackMode) => void;
  setTime: (isoTime: string) => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Seek to a position 0..1 within the time range */
  seekFraction: (fraction: number) => void;
  /** Get cursor position as fraction 0..1 within time range */
  getFraction: () => number;
}

const WINDOW_MS: Record<PlaybackMode, number> = {
  live: 0,
  '24h': 24 * 3600_000,
  '7d': 7 * 24 * 3600_000,
};

function computeTimeRange(mode: PlaybackMode): { start: string; end: string } {
  const now = Date.now();
  if (mode === 'live') {
    return {
      start: new Date(now - 24 * 3600_000).toISOString(),
      end: new Date(now).toISOString(),
    };
  }
  return {
    start: new Date(now - WINDOW_MS[mode]).toISOString(),
    end: new Date(now).toISOString(),
  };
}

export function usePlayback(): PlaybackState & PlaybackControls {
  const [mode, setModeRaw] = useState<PlaybackMode>('live');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedRaw] = useState<PlaybackSpeed>(1);
  const [timeRange, setTimeRange] = useState(() => computeTimeRange('live'));
  const [currentTime, setCurrentTime] = useState(() => new Date().toISOString());

  const animFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Switch mode
  const setMode = useCallback((newMode: PlaybackMode) => {
    setModeRaw(newMode);
    setIsPlaying(false);

    if (newMode === 'live') {
      setCurrentTime(new Date().toISOString());
      setTimeRange(computeTimeRange('live'));
    } else {
      const range = computeTimeRange(newMode);
      setTimeRange(range);
      setCurrentTime(range.end); // Start at the end (most recent)
    }
  }, []);

  // Set time directly
  const setTime = useCallback((isoTime: string) => {
    setCurrentTime(isoTime);
  }, []);

  // Seek by fraction (0..1)
  const seekFraction = useCallback((fraction: number) => {
    const startMs = new Date(timeRange.start).getTime();
    const endMs = new Date(timeRange.end).getTime();
    const t = startMs + fraction * (endMs - startMs);
    setCurrentTime(new Date(t).toISOString());
  }, [timeRange]);

  // Get current position as fraction
  const getFraction = useCallback((): number => {
    const startMs = new Date(timeRange.start).getTime();
    const endMs = new Date(timeRange.end).getTime();
    const curMs = new Date(currentTime).getTime();
    if (endMs <= startMs) return 1;
    return Math.max(0, Math.min(1, (curMs - startMs) / (endMs - startMs)));
  }, [timeRange, currentTime]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (mode === 'live') return; // No playback in live mode
    setIsPlaying((prev) => !prev);
  }, [mode]);

  // Set speed
  const setSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeedRaw(s);
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || mode === 'live') {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    lastFrameTimeRef.current = performance.now();

    const animate = (now: number) => {
      const dt = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Advance cursor by dt × speed (real-time milliseconds → playback milliseconds)
      const advanceMs = dt * speed;
      const curMs = new Date(currentTime).getTime();
      const endMs = new Date(timeRange.end).getTime();
      const newMs = curMs + advanceMs;

      if (newMs >= endMs) {
        setCurrentTime(timeRange.end);
        setIsPlaying(false);
        return;
      }

      setCurrentTime(new Date(newMs).toISOString());
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, mode, speed, currentTime, timeRange.end]);

  // In live mode, keep currentTime synced to real time
  useEffect(() => {
    if (mode !== 'live') return;

    const interval = setInterval(() => {
      setCurrentTime(new Date().toISOString());
      setTimeRange(computeTimeRange('live'));
    }, 5000);

    return () => clearInterval(interval);
  }, [mode]);

  return {
    mode,
    currentTime,
    isPlaying,
    speed,
    timeRange,
    setMode,
    setTime,
    togglePlay,
    setSpeed,
    seekFraction,
    getFraction,
  };
}
