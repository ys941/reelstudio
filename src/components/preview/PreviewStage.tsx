'use client';

// =============================================================================
// PreviewStage — the canvas-based live preview (VN/CapCut style).
// Hosts the media pool, the rAF CanvasPlayer, an interactive selection overlay,
// and the transport bar. No props; reads everything from `useEditor`.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clapperboard } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { useMediaPool } from './useMediaPool';
import { CanvasPlayer } from './CanvasPlayer';
import { SelectionOverlay } from './SelectionOverlay';
import { TransportBar } from './TransportBar';

interface CanvasRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

export default function PreviewStage() {
  const poolRef = useMediaPool();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasRect, setCanvasRect] = useState<CanvasRect | null>(null);

  const selectClip = useEditor((s) => s.selectClip);
  const aspectLabel = useEditor((s) => s.project.aspectRatio.label);
  // Show a friendly hint while the project is empty so the black canvas doesn't
  // look broken. Recomputed from the live track list; hidden the moment any
  // clip exists so it never overlaps real content or the selection overlay.
  const hasClips = useEditor((s) => s.project.tracks.some((t) => t.clips.length > 0));

  const onCanvasRect = useCallback((rect: CanvasRect) => {
    setCanvasRect((prev) =>
      prev &&
      prev.width === rect.width &&
      prev.height === rect.height &&
      prev.left === rect.left &&
      prev.top === rect.top
        ? prev
        : rect,
    );
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-panel backdrop-blur-xl">
      {/* Stage area */}
      <div
        data-preview-stage
        className="relative flex flex-1 items-center justify-center overflow-hidden p-5"
        onPointerDown={(e) => {
          // clicking empty stage clears selection
          if (e.target === e.currentTarget) selectClip(null);
        }}
      >
        {/* ambient violet glow behind the stage */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 42%, rgba(124,92,255,0.10), transparent 70%)',
          }}
        />
        <div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
          <CanvasPlayer poolRef={poolRef} onCanvasRect={onCanvasRect} containerRef={containerRef} />
          <SelectionOverlay canvasRect={canvasRect} />

          {/* Empty-state hint — only while the project has zero clips. Sized to
              the displayed canvas rect (falls back to the container) and fully
              non-interactive so it never blocks selection/stage clicks. */}
          {!hasClips && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none absolute z-30 flex flex-col items-center justify-center gap-3 text-center"
              style={
                canvasRect
                  ? {
                      left: canvasRect.left,
                      top: canvasRect.top,
                      width: canvasRect.width,
                      height: canvasRect.height,
                    }
                  : { inset: 0 }
              }
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-brand-2 shadow-[0_0_28px_rgba(124,92,255,0.28)] backdrop-blur-md">
                <Clapperboard size={26} strokeWidth={1.75} />
              </div>
              <div className="space-y-1 px-6">
                <p className="text-sm font-semibold text-white/85">Your canvas is empty</p>
                <p className="text-xs text-white/45">Import media or add text to begin</p>
              </div>
            </motion.div>
          )}
        </div>

        <motion.div
          key={aspectLabel}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute left-4 top-4 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60 backdrop-blur-md"
        >
          {aspectLabel}
        </motion.div>
      </div>

      {/* Transport */}
      <div className="border-t border-white/[0.06] bg-white/[0.02]">
        <TransportBar />
      </div>
    </div>
  );
}
