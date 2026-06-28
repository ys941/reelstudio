'use client';

import { useRef } from 'react';
import { Lock, EyeOff, Music2, Type as TypeIcon } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { cn, clamp } from '@/lib/utils';
import { MIN_CLIP_DURATION, SNAP_THRESHOLD_PX, TRACK_COLORS } from '@/lib/constants';
import type { Clip, Track } from '@/types/editor';

interface DragState {
  mode: 'move' | 'trim-start' | 'trim-end';
  startClientX: number;
  startClientY: number;
  origStart: number;
  origDuration: number;
  origTrackId: string;
  moved: boolean;
}

// Decorative static waveform bars for audio clips.
const WAVE_BARS = Array.from({ length: 64 }, (_, i) => {
  const a = Math.sin(i * 0.7) * 0.5 + 0.5;
  const b = Math.sin(i * 1.9 + 1) * 0.5 + 0.5;
  return clamp(0.2 + (a * 0.6 + b * 0.4) * 0.8, 0.12, 1);
});

function colorForTrackType(type: Track['type']): string {
  return TRACK_COLORS[type] ?? '#3b82f6';
}

export default function ClipChip({
  clip,
  track,
  laneHeight,
  allTracks,
}: {
  clip: Clip;
  track: Track;
  laneHeight: number;
  allTracks: Track[];
}) {
  const zoom = useEditor((s) => s.zoom);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const selectClip = useEditor((s) => s.selectClip);
  const moveClip = useEditor((s) => s.moveClip);
  const trimClip = useEditor((s) => s.trimClip);
  const commit = useEditor((s) => s.commit);

  const dragRef = useRef<DragState | null>(null);
  const selected = selectedClipId === clip.id;
  const baseColor = clip.color ?? colorForTrackType(track.type);

  const left = clip.start * zoom;
  const width = Math.max(6, clip.duration * zoom);

  // Build list of snap target X positions (in seconds) from other clips + playhead.
  function snapTargets(excludeId: string): number[] {
    const targets: number[] = [0];
    const st = useEditor.getState();
    for (const t of st.project.tracks) {
      for (const c of t.clips) {
        if (c.id === excludeId) continue;
        targets.push(c.start);
        targets.push(c.start + c.duration);
      }
    }
    targets.push(st.currentTime);
    return targets;
  }

  function applySnap(valueSec: number, targets: number[]): number {
    if (!snapEnabled) return valueSec;
    const thresholdSec = SNAP_THRESHOLD_PX / zoom;
    let best = valueSec;
    let bestDist = thresholdSec;
    for (const t of targets) {
      const d = Math.abs(t - valueSec);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  const beginDrag = (mode: DragState['mode']) => (e: React.PointerEvent) => {
    if (clip.locked || track.locked) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    selectClip(clip.id);
    commit();
    dragRef.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStart: clip.start,
      origDuration: clip.duration,
      origTrackId: clip.trackId,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dxPx = e.clientX - d.startClientX;
    const dxSec = dxPx / zoom;
    if (Math.abs(dxPx) > 2 || Math.abs(e.clientY - d.startClientY) > 2) d.moved = true;

    if (d.mode === 'move') {
      let newStart = Math.max(0, d.origStart + dxSec);
      const targets = snapTargets(clip.id);
      // snap leading edge or trailing edge, whichever is closer
      const snappedStart = applySnap(newStart, targets);
      const snappedEnd = applySnap(newStart + d.origDuration, targets) - d.origDuration;
      if (Math.abs(snappedStart - newStart) <= Math.abs(snappedEnd - newStart)) {
        newStart = snappedStart;
      } else {
        newStart = Math.max(0, snappedEnd);
      }

      // vertical track change among compatible tracks
      const dyPx = e.clientY - d.startClientY;
      let targetTrackId = d.origTrackId;
      if (Math.abs(dyPx) > laneHeight * 0.6) {
        const compatible = allTracks.filter((t) => t.type === track.type && !t.locked);
        const origIndex = compatible.findIndex((t) => t.id === d.origTrackId);
        if (origIndex !== -1) {
          const offset = Math.round(dyPx / laneHeight);
          const next = clamp(origIndex + offset, 0, compatible.length - 1);
          targetTrackId = compatible[next].id;
        }
      }
      moveClip(clip.id, newStart, targetTrackId);
    } else if (d.mode === 'trim-start') {
      let delta = dxSec;
      const targets = snapTargets(clip.id);
      const snappedEdge = applySnap(d.origStart + delta, targets);
      delta = snappedEdge - d.origStart;
      // enforce min duration handled in store; clamp here for responsiveness
      delta = Math.min(delta, d.origDuration - MIN_CLIP_DURATION);
      const curDelta = clip.start - d.origStart;
      trimClip(clip.id, 'start', delta - curDelta);
    } else if (d.mode === 'trim-end') {
      let delta = dxSec;
      const targets = snapTargets(clip.id);
      const snappedEdge = applySnap(d.origStart + d.origDuration + delta, targets);
      delta = snappedEdge - (d.origStart + d.origDuration);
      const curDelta = clip.duration - d.origDuration;
      trimClip(clip.id, 'end', delta - curDelta);
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current && !dragRef.current.moved) {
      selectClip(clip.id);
    }
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const isAudio = clip.type === 'audio';
  const isText = clip.type === 'text';
  const isMediaVisual = clip.type === 'video' || clip.type === 'image' || clip.type === 'overlay' || clip.type === 'sticker';

  return (
    <div
      className={cn(
        'group absolute top-1 cursor-grab overflow-hidden rounded-lg text-white shadow-lg shadow-black/30 active:cursor-grabbing',
        'transition-[box-shadow,transform] duration-150',
        selected ? 'z-20' : 'z-10 ring-1 ring-black/30',
        (clip.locked || track.locked) && 'cursor-not-allowed',
      )}
      style={{
        left,
        width,
        height: laneHeight - 8,
        background: `linear-gradient(160deg, ${baseColor}e6, ${baseColor}99)`,
      }}
      onPointerDown={beginDrag('move')}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
      }}
    >
      {/* selected ring: violet->cyan accent gradient */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-0 z-40 rounded-lg"
          style={{
            padding: 1.5,
            background: 'linear-gradient(135deg, #7c5cff, #22d3ee)',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            boxShadow: '0 0 0 1px rgba(124,92,255,0.35), 0 4px 18px rgba(124,92,255,0.35)',
          }}
        />
      )}
      {/* top hairline highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
      {/* subtle gradient sheen for visual media */}
      {isMediaVisual && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0) 40%, rgba(0,0,0,0.25))',
          }}
        />
      )}

      {/* waveform for audio */}
      {isAudio && (
        <div className="pointer-events-none absolute inset-x-1.5 bottom-1 top-4 flex items-center justify-between overflow-hidden">
          {WAVE_BARS.map((h, i) => (
            <div
              key={i}
              className="w-px shrink-0 rounded-full bg-white/55"
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
      )}

      {/* label */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1 px-1.5 pt-1">
        {isAudio && <Music2 size={10} className="shrink-0 text-white/80" />}
        {isText && <TypeIcon size={10} className="shrink-0 text-white/80" />}
        {clip.locked && <Lock size={10} className="shrink-0 text-white/80" />}
        {clip.hidden && <EyeOff size={10} className="shrink-0 text-white/80" />}
        <span className="truncate text-[10px] font-semibold leading-none drop-shadow">{clip.name}</span>
      </div>

      {/* trim handles */}
      {!clip.locked && !track.locked && (
        <>
          <div
            className="absolute inset-y-0 left-0 z-30 flex w-2 cursor-ew-resize items-center justify-center transition-colors hover:bg-white/20"
            onPointerDown={beginDrag('trim-start')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
          >
            <div className="h-1/2 w-[3px] rounded-full bg-white/70 opacity-0 shadow transition-opacity group-hover:opacity-100" />
          </div>
          <div
            className="absolute inset-y-0 right-0 z-30 flex w-2 cursor-ew-resize items-center justify-center transition-colors hover:bg-white/20"
            onPointerDown={beginDrag('trim-end')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
          >
            <div className="h-1/2 w-[3px] rounded-full bg-white/70 opacity-0 shadow transition-opacity group-hover:opacity-100" />
          </div>
        </>
      )}
    </div>
  );
}
