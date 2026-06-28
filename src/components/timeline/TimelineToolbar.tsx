'use client';

import {
  Play,
  Pause,
  Scissors,
  Copy,
  Trash2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Plus,
  Film,
  Music,
  Type,
  Layers,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useEditor } from '@/store/editorStore';
import { cn, formatTimecode } from '@/lib/utils';
import { ZOOM_LEVELS } from '@/lib/constants';
import type { TrackType } from '@/types/editor';

function ToolButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition',
        'hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30',
        active && 'bg-gradient-to-br from-brand/25 to-accent/20 text-white ring-1 ring-brand/40',
      )}
    >
      {children}
    </button>
  );
}

const TRACK_TYPES: { type: TrackType; label: string; icon: React.ReactNode }[] = [
  { type: 'video', label: 'Video', icon: <Film size={14} /> },
  { type: 'audio', label: 'Audio', icon: <Music size={14} /> },
  { type: 'text', label: 'Text', icon: <Type size={14} /> },
  { type: 'overlay', label: 'Overlay', icon: <Layers size={14} /> },
];

export default function TimelineToolbar() {
  const isPlaying = useEditor((s) => s.isPlaying);
  const togglePlay = useEditor((s) => s.togglePlay);
  const currentTime = useEditor((s) => s.currentTime);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const setSnap = useEditor((s) => s.setSnap);
  const selectedClipId = useEditor((s) => s.selectedClipId);
  const splitClipAt = useEditor((s) => s.splitClipAt);
  const duplicateClip = useEditor((s) => s.duplicateClip);
  const removeClip = useEditor((s) => s.removeClip);
  const addTrack = useEditor((s) => s.addTrack);
  const getDuration = useEditor((s) => s.getDuration);
  const fps = useEditor((s) => s.project.fps);

  const duration = getDuration();
  const [trackMenuOpen, setTrackMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTrackMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [trackMenuOpen]);

  const zoomIndex = (() => {
    // closest current level
    let idx = 0;
    let best = Infinity;
    ZOOM_LEVELS.forEach((z, i) => {
      const d = Math.abs(z - zoom);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    return idx;
  })();

  const zoomIn = () => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1)]);
  const zoomOut = () => setZoom(ZOOM_LEVELS[Math.max(0, zoomIndex - 1)]);

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] px-2 backdrop-blur-xl">
      <button
        type="button"
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        onClick={togglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-accent text-white shadow-brand transition hover:brightness-110 active:scale-95"
      >
        {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>

      <div className="ml-1 flex items-baseline gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 font-mono text-xs tabular-nums">
        <span className="text-white">{formatTimecode(currentTime, fps)}</span>
        <span className="text-white/25">/</span>
        <span className="text-white/40">{formatTimecode(duration, fps)}</span>
      </div>

      <div className="mx-2 h-5 w-px bg-white/[0.08]" />

      <ToolButton title="Split at playhead (S)" onClick={() => splitClipAt()} disabled={!selectedClipId}>
        <Scissors size={16} />
      </ToolButton>
      <ToolButton
        title="Duplicate clip"
        onClick={() => selectedClipId && duplicateClip(selectedClipId)}
        disabled={!selectedClipId}
      >
        <Copy size={16} />
      </ToolButton>
      <ToolButton
        title="Delete clip (Del)"
        onClick={() => selectedClipId && removeClip(selectedClipId)}
        disabled={!selectedClipId}
      >
        <Trash2 size={16} />
      </ToolButton>

      <div className="mx-2 h-5 w-px bg-white/[0.08]" />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setTrackMenuOpen((o) => !o)}
          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Plus size={14} /> Track
        </button>
        {trackMenuOpen && (
          <div className="absolute left-0 top-9 z-50 w-40 overflow-hidden rounded-xl border border-white/[0.08] bg-panel-2/95 py-1 shadow-panel backdrop-blur-xl animate-fade-in">
            {TRACK_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => {
                  addTrack(t.type);
                  setTrackMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="text-brand-2">{t.icon}</span>
                {t.label} track
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ToolButton title={snapEnabled ? 'Snapping on' : 'Snapping off'} onClick={() => setSnap(!snapEnabled)} active={snapEnabled}>
          <Magnet size={16} />
        </ToolButton>

        <div className="mx-1 h-5 w-px bg-white/[0.08]" />

        <ToolButton title="Zoom out" onClick={zoomOut} disabled={zoomIndex === 0}>
          <ZoomOut size={16} />
        </ToolButton>
        <span className="w-12 text-center font-mono text-[10px] tabular-nums text-white/40">{Math.round(zoom)}px/s</span>
        <ToolButton title="Zoom in" onClick={zoomIn} disabled={zoomIndex === ZOOM_LEVELS.length - 1}>
          <ZoomIn size={16} />
        </ToolButton>
      </div>
    </div>
  );
}
