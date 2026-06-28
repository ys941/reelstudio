'use client';

import { Volume2, VolumeX, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { TRACK_COLORS } from '@/lib/constants';
import type { Track } from '@/types/editor';
import ClipChip from './ClipChip';

function HeaderToggle({
  on,
  onClick,
  title,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.07] hover:text-white',
        on && 'bg-white/[0.06] text-accent',
      )}
    >
      {children}
    </button>
  );
}

export function TrackHeader({ track }: { track: Track }) {
  const toggleMute = useEditor((s) => s.toggleTrackMute);
  const toggleLock = useEditor((s) => s.toggleTrackLock);
  const toggleHidden = useEditor((s) => s.toggleTrackHidden);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const selectTrack = useEditor((s) => s.selectTrack);

  const color = TRACK_COLORS[track.type] ?? '#3b82f6';

  return (
    <div
      onClick={() => selectTrack(track.id)}
      className={cn(
        'relative flex items-center gap-2 border-b border-white/[0.05] px-2.5 transition-colors',
        selectedTrackId === track.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]',
      )}
      style={{ height: track.height }}
    >
      {selectedTrackId === track.id && (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-brand to-accent" />
      )}
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
        style={{ background: color, boxShadow: `0 0 8px ${color}66` }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-white/80">{track.name}</div>
        <div className="text-[9px] uppercase tracking-wide text-white/30">{track.type}</div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderToggle on={track.muted} onClick={() => toggleMute(track.id)} title={track.muted ? 'Unmute' : 'Mute'}>
          {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </HeaderToggle>
        <HeaderToggle on={track.hidden} onClick={() => toggleHidden(track.id)} title={track.hidden ? 'Show' : 'Hide'}>
          {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </HeaderToggle>
        <HeaderToggle on={track.locked} onClick={() => toggleLock(track.id)} title={track.locked ? 'Unlock' : 'Lock'}>
          {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </HeaderToggle>
      </div>
    </div>
  );
}

export function TrackLane({
  track,
  width,
  allTracks,
}: {
  track: Track;
  width: number;
  allTracks: Track[];
}) {
  const selectClip = useEditor((s) => s.selectClip);

  return (
    <div
      className={cn(
        'group/lane relative border-b border-white/[0.04]',
        track.hidden && 'opacity-40',
      )}
      style={{ height: track.height, width }}
      onClick={() => selectClip(null)}
    >
      {/* lane background stripe */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.015] to-transparent" />
      {track.clips.length === 0 && (
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[10px] font-medium uppercase tracking-wide text-white/15 transition-colors group-hover/lane:text-white/25">
          Drop {track.type} here
        </div>
      )}
      {track.clips.map((clip) => (
        <ClipChip
          key={clip.id}
          clip={clip}
          track={track}
          laneHeight={track.height}
          allTracks={allTracks}
        />
      ))}
    </div>
  );
}
