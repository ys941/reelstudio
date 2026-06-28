'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditor } from '@/store/editorStore';
import TimelineToolbar from './TimelineToolbar';
import TimelineRuler from './TimelineRuler';
import Playhead from './Playhead';
import { TrackHeader, TrackLane } from './TrackRow';

const TRACK_HEADER_WIDTH = 168;
const MIN_VIEW_SECONDS = 30; // always render at least this much timeline
const TAIL_SECONDS = 12; // padding after the content end

export default function Timeline() {
  const tracks = useEditor((s) => s.project.tracks);
  const zoom = useEditor((s) => s.zoom);
  const isPlaying = useEditor((s) => s.isPlaying);
  const pause = useEditor((s) => s.pause);
  const togglePlay = useEditor((s) => s.togglePlay);
  const splitClipAt = useEditor((s) => s.splitClipAt);
  const removeClip = useEditor((s) => s.removeClip);
  const getDuration = useEditor((s) => s.getDuration);

  const headerScrollRef = useRef<HTMLDivElement>(null); // vertical: track headers
  const laneScrollRef = useRef<HTMLDivElement>(null); // both axes: lanes
  const rulerWrapRef = useRef<HTMLDivElement>(null); // horizontal: ruler

  // ----- content width -----
  const duration = getDuration();
  const viewSeconds = Math.max(MIN_VIEW_SECONDS, duration + TAIL_SECONDS);
  const contentWidth = viewSeconds * zoom;
  const totalLaneHeight = useMemo(
    () => tracks.reduce((sum, t) => sum + t.height, 0),
    [tracks],
  );

  // NOTE: the playhead/time advance during playback is owned solely by the
  // CanvasPlayer rAF loop (it must be frame-driven for the canvas anyway).
  // Running a second loop here would double-advance currentTime (~2x speed).

  // ----- synced scrolling -----
  const onLaneScroll = useCallback(() => {
    const lane = laneScrollRef.current;
    if (!lane) return;
    if (rulerWrapRef.current) rulerWrapRef.current.scrollLeft = lane.scrollLeft;
    if (headerScrollRef.current) headerScrollRef.current.scrollTop = lane.scrollTop;
  }, []);

  const onHeaderScroll = useCallback(() => {
    const header = headerScrollRef.current;
    if (!header || !laneScrollRef.current) return;
    laneScrollRef.current.scrollTop = header.scrollTop;
  }, []);

  // ----- auto-scroll to keep the playhead visible during playback -----
  const currentTime = useEditor((s) => s.currentTime);
  useEffect(() => {
    if (!isPlaying) return;
    const lane = laneScrollRef.current;
    if (!lane) return;
    const playX = currentTime * zoom;
    const viewLeft = lane.scrollLeft;
    const viewRight = viewLeft + lane.clientWidth;
    if (playX > viewRight - 60) {
      lane.scrollLeft = playX - lane.clientWidth * 0.5;
    } else if (playX < viewLeft) {
      lane.scrollLeft = Math.max(0, playX - 40);
    }
  }, [currentTime, isPlaying, zoom]);

  // ----- keyboard shortcuts -----
  // Bound at the window level so Space/Del/S work regardless of which element
  // currently has focus (clicking a clip, the canvas, etc. doesn't focus the
  // timeline). Typing in inputs/textareas/contentEditable is always ignored.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (typing) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useEditor.getState().selectedClipId;
        if (id) {
          e.preventDefault();
          removeClip(id);
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        splitClipAt();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, removeClip, splitClipAt]);

  // pause playback on unmount to avoid an orphaned rAF flag
  useEffect(() => {
    return () => {
      if (useEditor.getState().isPlaying) pause();
    };
  }, [pause]);

  return (
    <div
      ref={rootRef}
      className="flex h-[290px] shrink-0 flex-col border-t border-white/[0.06] bg-canvas/60 outline-none backdrop-blur-xl"
    >
      <TimelineToolbar />

      {/* Ruler row: fixed spacer over headers + horizontally-scrolling rail */}
      <div className="flex shrink-0">
        <div
          className="shrink-0 border-b border-r border-white/[0.06] bg-white/[0.02]"
          style={{ width: TRACK_HEADER_WIDTH, height: 28 }}
        />
        <div ref={rulerWrapRef} className="flex-1 overflow-x-hidden">
          <TimelineRuler width={contentWidth} />
        </div>
      </div>

      {/* Body: track headers (left) + lanes (right) */}
      <div className="flex min-h-0 flex-1">
        {/* track headers */}
        <div
          ref={headerScrollRef}
          onScroll={onHeaderScroll}
          className="shrink-0 overflow-y-auto overflow-x-hidden border-r border-white/[0.06] bg-white/[0.02] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
          <div>
            {tracks.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-white/30">No tracks</div>
            ) : (
              tracks.map((t) => <TrackHeader key={t.id} track={t} />)
            )}
          </div>
        </div>

        {/* lanes */}
        <div
          ref={laneScrollRef}
          onScroll={onLaneScroll}
          className="relative min-w-0 flex-1 overflow-auto"
        >
          <div className="relative" style={{ width: contentWidth, minHeight: '100%' }}>
            {tracks.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[11px] text-white/30">
                Add a track to get started
              </div>
            ) : (
              tracks.map((t) => (
                <TrackLane key={t.id} track={t} width={contentWidth} allTracks={tracks} />
              ))
            )}
            {/* Playhead spans all lanes */}
            <Playhead height={Math.max(totalLaneHeight, 1)} />
          </div>
        </div>
      </div>
    </div>
  );
}
