'use client';

import { useCallback, useRef } from 'react';
import { useEditor } from '@/store/editorStore';
import { formatTime } from '@/lib/utils';

// Choose a "nice" tick interval (in seconds) so labels stay readable at any zoom.
function chooseStep(zoom: number): number {
  // aim for a major label roughly every ~80px
  const target = 80 / zoom; // seconds per major tick wanted
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return 600;
}

/**
 * The time rail. Rendered inside a horizontally-scrolling wrapper whose
 * scrollLeft is kept in sync with the lane area, so the rail itself only
 * needs to size its content. Clicking/dragging seeks. We resolve the click
 * position against the scrolling wrapper (offsetParent-relative) so the
 * mapping stays correct regardless of scroll offset.
 */
export default function TimelineRuler({ width }: { width: number; trackHeaderWidth?: number }) {
  const zoom = useEditor((s) => s.zoom);
  const seek = useEditor((s) => s.seek);
  const railRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const step = chooseStep(zoom);
  const totalSeconds = width / zoom;
  const majorTicks: number[] = [];
  for (let t = 0; t <= totalSeconds + step; t += step) {
    majorTicks.push(Math.round(t * 1000) / 1000);
  }

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = railRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // rect already accounts for the wrapper's scroll offset, so this is direct.
      const x = clientX - rect.left;
      seek(Math.max(0, x / zoom));
    },
    [seek, zoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    seekFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={railRef}
      className="relative h-7 cursor-text select-none border-b border-white/[0.06] bg-white/[0.015]"
      style={{ width }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {majorTicks.map((t) => {
        const left = t * zoom;
        return (
          <div key={t} className="absolute top-0 h-full" style={{ left }}>
            <div className="absolute bottom-0 h-2.5 w-px bg-white/25" />
            <span className="absolute left-1 top-0.5 font-mono text-[9px] tabular-nums text-white/35">
              {formatTime(t, step < 1)}
            </span>
          </div>
        );
      })}
      {/* minor ticks (4 subdivisions) */}
      {majorTicks.map((t) =>
        [1, 2, 3].map((i) => {
          const sub = step / 4;
          const tt = t + sub * i;
          const left = tt * zoom;
          return (
            <div
              key={`${t}-${i}`}
              className="absolute bottom-0 h-1.5 w-px bg-white/10"
              style={{ left }}
            />
          );
        }),
      )}
    </div>
  );
}
