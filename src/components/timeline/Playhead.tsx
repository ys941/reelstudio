'use client';

import { useCallback, useRef } from 'react';
import { useEditor } from '@/store/editorStore';

/**
 * Vertical playhead line spanning all lanes. Positioned relative to the
 * scrollable lane area (so it shares the same coordinate space as clips).
 * The triangle handle at top is draggable to scrub.
 */
export default function Playhead({ height }: { height: number }) {
  const currentTime = useEditor((s) => s.currentTime);
  const zoom = useEditor((s) => s.zoom);
  const seek = useEditor((s) => s.seek);
  const dragging = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      // The playhead is positioned inside the timeline content div (width =
      // contentWidth). That div's left edge already reflects horizontal scroll,
      // so a plain clientX - rect.left maps straight into content coordinates.
      const el = rootRef.current?.parentElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      seek(Math.max(0, x / zoom));
    },
    [seek, zoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    seekFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const left = currentTime * zoom;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute top-0 z-40"
      style={{ left, height }}
    >
      <div className="relative h-full">
        {/* handle — rounded pill with grip */}
        <div
          className="pointer-events-auto absolute -left-[7px] -top-[3px] z-10 cursor-ew-resize"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="flex h-[15px] w-[15px] items-center justify-center rounded-md bg-gradient-to-br from-brand to-accent shadow-[0_2px_8px_rgba(124,92,255,0.55)] ring-1 ring-white/30">
            <div className="h-1.5 w-px bg-white/80" />
          </div>
        </div>
        {/* line — violet->cyan gradient */}
        <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-brand via-accent to-accent/70 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
      </div>
    </div>
  );
}
