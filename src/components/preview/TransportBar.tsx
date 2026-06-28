'use client';

// =============================================================================
// TransportBar — play/pause, current/total time, and a scrubber that seeks.
// Sits directly under the canvas.
// =============================================================================

import { useEditor } from '@/store/editorStore';
import { formatTime } from '@/lib/utils';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

export function TransportBar() {
  const isPlaying = useEditor((s) => s.isPlaying);
  const currentTime = useEditor((s) => s.currentTime);
  const togglePlay = useEditor((s) => s.togglePlay);
  const seek = useEditor((s) => s.seek);
  // getDuration is derived; read project so the bar updates when clips change.
  useEditor((s) => s.project);
  const duration = useEditor.getState().getDuration();

  const clamped = Math.min(currentTime, duration || 0);
  const pct = duration > 0 ? (clamped / duration) * 100 : 0;

  return (
    <div className="flex w-full items-center gap-3 px-3 py-2.5 text-white/80">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => seek(0)}
          className="rounded-lg p-1.5 text-white/55 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
          title="Jump to start"
        >
          <SkipBack size={15} />
        </button>
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-white shadow-brand transition hover:brightness-110 active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <button
          onClick={() => seek(duration)}
          className="rounded-lg p-1.5 text-white/55 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
          title="Jump to end"
        >
          <SkipForward size={15} />
        </button>
      </div>

      <span className="w-[64px] shrink-0 text-right font-mono text-[11px] tabular-nums text-white/75">
        {formatTime(clamped)}
      </span>

      <div className="group relative flex-1 py-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-accent shadow-[0_0_8px_rgba(124,92,255,0.5)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0.001, duration)}
          step={0.01}
          value={clamped}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Scrubber"
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-transform group-hover:scale-110"
          style={{ left: `${pct}%` }}
        />
      </div>

      <span className="w-[64px] shrink-0 font-mono text-[11px] tabular-nums text-white/40">
        {formatTime(duration)}
      </span>
    </div>
  );
}
