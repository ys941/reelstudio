'use client';

// =============================================================================
// SelectionOverlay — an HTML bounding box positioned over the canvas for the
// currently selected + active clip. Drag the body to move (updateTransform x/y),
// corner handles to scale, and the top handle to rotate. Pointer deltas are
// converted to normalized transform space using the displayed canvas size.
// =============================================================================

import { useRef, useState } from 'react';
import { useEditor } from '@/store/editorStore';
import { resolveTransform } from '@/lib/render';
import { clamp } from '@/lib/utils';
import type { Clip } from '@/types/editor';

interface CanvasRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

type DragMode =
  | { kind: 'move' }
  | { kind: 'scale'; corner: 'tl' | 'tr' | 'bl' | 'br' }
  | { kind: 'rotate' };

export function SelectionOverlay({ canvasRect }: { canvasRect: CanvasRect | null }) {
  const selectedId = useEditor((s) => s.selectedClipId);
  const currentTime = useEditor((s) => s.currentTime);
  const isPlaying = useEditor((s) => s.isPlaying);
  // subscribe to project so the box follows live transform edits
  const project = useEditor((s) => s.project);
  const updateTransform = useEditor((s) => s.updateTransform);
  const commit = useEditor((s) => s.commit);

  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const clip: Clip | undefined = (() => {
    if (!selectedId) return undefined;
    for (const tr of project.tracks) {
      const c = tr.clips.find((x) => x.id === selectedId);
      if (c) return c;
    }
    return undefined;
  })();

  const isActive =
    !!clip && currentTime >= clip.start && currentTime < clip.start + clip.duration && !clip.hidden;

  if (!clip || !isActive || !canvasRect || isPlaying) return null;
  // audio has no visual box; everything else (video/image/text/overlay/sticker) does.
  if (clip.type === 'audio') return null;

  const tf = resolveTransform(clip, currentTime);

  // Estimate the on-screen box size. Base media fills the frame * scale; PIP/text
  // get a smaller grabbable affordance.
  const baseFrac = clip.type === 'video' || clip.type === 'image' ? 1 : 0.5;
  const boxW = canvasRect.width * baseFrac * tf.scale;
  const boxH = canvasRect.height * baseFrac * tf.scale;

  // center in container coordinates (overlay is absolutely positioned over canvas)
  const centerX = canvasRect.left + canvasRect.width / 2 + (tf.x * canvasRect.width) / 2;
  const centerY = canvasRect.top + canvasRect.height / 2 + (tf.y * canvasRect.height) / 2;

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clip.locked) return;
    const id = selectedId!;
    const rect = canvasRect;
    commit();
    setDragging(true);

    // box center in viewport px. canvasRect (and therefore centerX/centerY) is
    // measured relative to the overlay's own container (the inner flex box that
    // wraps the canvas), NOT the padded stage. Use the overlay root's viewport
    // rect as the origin so the scale/rotate pivot lands exactly on the box
    // center — using the stage rect here would be off by the stage padding.
    const originBox = rootRef.current?.getBoundingClientRect();
    const vx = (originBox?.left ?? 0) + centerX;
    const vy = (originBox?.top ?? 0) + centerY;

    const startX = e.clientX;
    const startY = e.clientY;
    const startTf = { x: tf.x, y: tf.y, scale: tf.scale, rotation: tf.rotation };
    const startDist = Math.hypot(startX - vx, startY - vy) || 1;

    const onMove = (ev: PointerEvent) => {
      if (mode.kind === 'move') {
        const nx = startTf.x + (ev.clientX - startX) / (rect.width / 2);
        const ny = startTf.y + (ev.clientY - startY) / (rect.height / 2);
        updateTransform(id, { x: clamp(nx, -2, 2), y: clamp(ny, -2, 2) });
      } else if (mode.kind === 'scale') {
        const curDist = Math.hypot(ev.clientX - vx, ev.clientY - vy);
        updateTransform(id, { scale: clamp(startTf.scale * (curDist / startDist), 0.05, 8) });
      } else if (mode.kind === 'rotate') {
        const a0 = Math.atan2(startY - vy, startX - vx);
        const a1 = Math.atan2(ev.clientY - vy, ev.clientX - vx);
        let deg = startTf.rotation + ((a1 - a0) * 180) / Math.PI;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        updateTransform(id, { rotation: deg });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handle =
    'absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-accent shadow-[0_0_8px_rgba(34,211,238,0.6)]';

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20" style={{ contain: 'layout' }}>
      <div
        className="pointer-events-auto absolute"
        style={{
          left: centerX,
          top: centerY,
          width: boxW,
          height: boxH,
          transform: `translate(-50%, -50%) rotate(${tf.rotation}deg)`,
          touchAction: 'none',
          opacity: dragging ? 0.95 : 1,
        }}
      >
        {/* body (move) — accent gradient border via outline */}
        <div
          onPointerDown={startDrag({ kind: 'move' })}
          className="absolute inset-0 cursor-move rounded-[3px]"
          style={{
            border: '1.5px solid rgba(124,92,255,0.95)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.45), 0 0 12px rgba(124,92,255,0.25)',
          }}
        />

        {/* corner scale handles */}
        <div onPointerDown={startDrag({ kind: 'scale', corner: 'tl' })} className={`${handle} left-0 top-0 cursor-nwse-resize`} />
        <div onPointerDown={startDrag({ kind: 'scale', corner: 'tr' })} className={`${handle} left-full top-0 cursor-nesw-resize`} />
        <div onPointerDown={startDrag({ kind: 'scale', corner: 'bl' })} className={`${handle} left-0 top-full cursor-nesw-resize`} />
        <div onPointerDown={startDrag({ kind: 'scale', corner: 'br' })} className={`${handle} left-full top-full cursor-nwse-resize`} />

        {/* rotate handle (above top edge) */}
        <div className="absolute left-1/2 top-0 h-[18px] w-px -translate-x-1/2 -translate-y-full bg-gradient-to-b from-accent to-brand/70" />
        <div
          onPointerDown={startDrag({ kind: 'rotate' })}
          className="absolute left-1/2 top-0 h-3 w-3 cursor-grab rounded-full border border-white/90 bg-gradient-to-br from-brand to-accent shadow-[0_0_8px_rgba(124,92,255,0.6)]"
          style={{ transform: 'translate(-50%, calc(-100% - 18px))' }}
        />
      </div>
    </div>
  );
}
