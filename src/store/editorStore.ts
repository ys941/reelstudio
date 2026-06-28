'use client';

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { ASPECT_RATIOS, DEFAULT_ZOOM, MIN_CLIP_DURATION } from '@/lib/constants';
import { clamp } from '@/lib/utils';
import {
  type Adjustments,
  type AspectRatioKey,
  type AudioProps,
  type ChromaKey,
  type Clip,
  type ClipType,
  type Easing,
  type ExportSettings,
  type ID,
  type Keyframe,
  type KeyframeableProp,
  type MediaAsset,
  type PanelKey,
  type Project,
  type SpeedControl,
  type TextStyle,
  type Track,
  type TrackType,
  type Transform,
  type Transition,
  type Watermark,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_AUDIO,
  DEFAULT_CHROMA,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_SPEED,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  DEFAULT_WATERMARK,
} from '@/types/editor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTrack(type: TrackType, name?: string): Track {
  return {
    id: nanoid(8),
    type,
    name: name ?? `${type[0].toUpperCase()}${type.slice(1)} track`,
    clips: [],
    muted: false,
    locked: false,
    hidden: false,
    height: type === 'audio' ? 56 : 72,
  };
}

function makeProject(): Project {
  return {
    id: nanoid(8),
    name: 'Untitled project',
    aspectRatio: ASPECT_RATIOS['9:16'],
    fps: 30,
    backgroundColor: '#000000',
    tracks: [
      makeTrack('overlay', 'Overlay 1'),
      makeTrack('text', 'Text 1'),
      makeTrack('video', 'Video 1'),
      makeTrack('audio', 'Audio 1'),
    ],
    watermark: { ...DEFAULT_WATERMARK },
  };
}

function clipBase(type: ClipType, trackId: ID, partial: Partial<Clip>): Clip {
  return {
    id: nanoid(8),
    type,
    trackId,
    name: partial.name ?? type,
    start: partial.start ?? 0,
    duration: partial.duration ?? 4,
    inPoint: partial.inPoint ?? 0,
    outPoint: partial.outPoint ?? partial.duration ?? 4,
    transform: { ...DEFAULT_TRANSFORM, ...(partial.transform || {}) },
    adjustments: { ...DEFAULT_ADJUSTMENTS, ...(partial.adjustments || {}) },
    chroma: { ...DEFAULT_CHROMA, ...(partial.chroma || {}) },
    speed: { ...DEFAULT_SPEED, ...(partial.speed || {}) },
    audio: { ...DEFAULT_AUDIO, ...(partial.audio || {}) },
    keyframes: partial.keyframes ?? {},
    transitionIn: partial.transitionIn ?? { type: 'none', duration: 0.5 },
    text: partial.text,
    assetId: partial.assetId,
    blendMode: partial.blendMode,
    locked: false,
    hidden: false,
    color: partial.color,
  };
}

function trackTypeForClip(type: ClipType): TrackType {
  if (type === 'audio') return 'audio';
  if (type === 'text') return 'text';
  if (type === 'overlay' || type === 'sticker') return 'overlay';
  return 'video';
}

/** Find the next free start position on a track (append at end). */
function nextFreeStart(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------
interface EditorState {
  project: Project;
  mediaAssets: MediaAsset[];

  selectedClipId: ID | null;
  selectedTrackId: ID | null;

  currentTime: number;
  isPlaying: boolean;
  zoom: number; // px per second
  snapEnabled: boolean;
  panel: PanelKey;

  exportSettings: ExportSettings;
  isExporting: boolean;
  exportProgress: number; // 0..1
  exportStage: string;

  // history
  _past: Project[];
  _future: Project[];

  // --- derived helpers ---
  getDuration: () => number;
  getClip: (id: ID | null) => Clip | undefined;
  getSelectedClip: () => Clip | undefined;
  getTrack: (id: ID) => Track | undefined;
  getTrackOfClip: (clipId: ID) => Track | undefined;
  getActiveClipsAt: (time: number) => Clip[];

  // --- project ---
  setProjectName: (name: string) => void;
  setAspectRatio: (key: AspectRatioKey) => void;
  setBackgroundColor: (color: string) => void;
  setFps: (fps: number) => void;
  loadProject: (p: Project) => void;
  resetProject: () => void;

  // --- media ---
  addMediaAsset: (a: MediaAsset) => void;
  removeMediaAsset: (id: ID) => void;

  // --- tracks ---
  addTrack: (type: TrackType) => ID;
  removeTrack: (id: ID) => void;
  updateTrack: (id: ID, patch: Partial<Track>) => void;
  toggleTrackMute: (id: ID) => void;
  toggleTrackLock: (id: ID) => void;
  toggleTrackHidden: (id: ID) => void;

  // --- clips ---
  addClip: (clip: Clip) => ID;
  addClipFromAsset: (assetId: ID, opts?: { start?: number; trackId?: ID }) => ID | null;
  addTextClip: (opts?: { start?: number; text?: string }) => ID;
  addOverlayClip: (assetId: ID, opts?: { start?: number }) => ID | null;
  removeClip: (id: ID) => void;
  duplicateClip: (id: ID) => ID | null;
  updateClip: (id: ID, patch: Partial<Clip>) => void;
  updateTransform: (id: ID, patch: Partial<Transform>) => void;
  updateAdjustments: (id: ID, patch: Partial<Adjustments>) => void;
  updateAudio: (id: ID, patch: Partial<AudioProps>) => void;
  updateText: (id: ID, patch: Partial<TextStyle>) => void;
  updateSpeed: (id: ID, patch: Partial<SpeedControl>) => void;
  updateChroma: (id: ID, patch: Partial<ChromaKey>) => void;
  setTransition: (id: ID, t: Transition) => void;

  moveClip: (id: ID, start: number, trackId?: ID) => void;
  trimClip: (id: ID, edge: 'start' | 'end', deltaSeconds: number) => void;
  splitClipAt: (time?: number) => void;

  // --- keyframes ---
  addKeyframe: (clipId: ID, prop: KeyframeableProp, time: number, value: number, easing?: Easing) => void;
  updateKeyframe: (clipId: ID, prop: KeyframeableProp, kfId: ID, patch: Partial<Keyframe>) => void;
  removeKeyframe: (clipId: ID, prop: KeyframeableProp, kfId: ID) => void;

  // --- watermark ---
  updateWatermark: (patch: Partial<Watermark>) => void;
  toggleWatermark: () => void;

  // --- selection / playback / view ---
  selectClip: (id: ID | null) => void;
  selectTrack: (id: ID | null) => void;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setZoom: (z: number) => void;
  setSnap: (on: boolean) => void;
  setPanel: (p: PanelKey) => void;

  // --- export ---
  updateExportSettings: (patch: Partial<ExportSettings>) => void;
  setExporting: (on: boolean) => void;
  setExportProgress: (p: number, stage?: string) => void;

  // --- history ---
  commit: () => void; // snapshot current project for undo
  undo: () => void;
  redo: () => void;
}

// Mutate the project immutably + return new tracks array.
function withClip(project: Project, clipId: ID, fn: (c: Clip) => Clip): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)),
    })),
  };
}

export const useEditor = create<EditorState>((set, get) => ({
  project: makeProject(),
  mediaAssets: [],
  selectedClipId: null,
  selectedTrackId: null,
  currentTime: 0,
  isPlaying: false,
  zoom: DEFAULT_ZOOM,
  snapEnabled: true,
  panel: 'media',
  exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
  isExporting: false,
  exportProgress: 0,
  exportStage: '',
  _past: [],
  _future: [],

  // ---- derived ----
  getDuration: () => {
    const { project } = get();
    let max = 0;
    for (const t of project.tracks)
      for (const c of t.clips) max = Math.max(max, c.start + c.duration);
    return max;
  },
  getClip: (id) => {
    if (!id) return undefined;
    for (const t of get().project.tracks) {
      const c = t.clips.find((x) => x.id === id);
      if (c) return c;
    }
    return undefined;
  },
  getSelectedClip: () => get().getClip(get().selectedClipId),
  getTrack: (id) => get().project.tracks.find((t) => t.id === id),
  getTrackOfClip: (clipId) =>
    get().project.tracks.find((t) => t.clips.some((c) => c.id === clipId)),
  getActiveClipsAt: (time) => {
    const out: Clip[] = [];
    for (const t of get().project.tracks) {
      if (t.hidden) continue;
      for (const c of t.clips) {
        if (c.hidden) continue;
        if (time >= c.start && time < c.start + c.duration) out.push(c);
      }
    }
    return out;
  },

  // ---- project ----
  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),
  setAspectRatio: (key) =>
    set((s) => ({ project: { ...s.project, aspectRatio: ASPECT_RATIOS[key] } })),
  setBackgroundColor: (backgroundColor) =>
    set((s) => ({ project: { ...s.project, backgroundColor } })),
  setFps: (fps) => set((s) => ({ project: { ...s.project, fps } })),
  loadProject: (p) => set({ project: p, selectedClipId: null, currentTime: 0 }),
  resetProject: () =>
    set({ project: makeProject(), selectedClipId: null, currentTime: 0, _past: [], _future: [] }),

  // ---- media ----
  addMediaAsset: (a) => set((s) => ({ mediaAssets: [a, ...s.mediaAssets] })),
  removeMediaAsset: (id) =>
    set((s) => ({ mediaAssets: s.mediaAssets.filter((a) => a.id !== id) })),

  // ---- tracks ----
  addTrack: (type) => {
    const t = makeTrack(type);
    set((s) => ({ project: { ...s.project, tracks: [t, ...s.project.tracks] } }));
    return t.id;
  },
  removeTrack: (id) =>
    set((s) => ({
      project: { ...s.project, tracks: s.project.tracks.filter((t) => t.id !== id) },
    })),
  updateTrack: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    })),
  toggleTrackMute: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
      },
    })),
  toggleTrackLock: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t)),
      },
    })),
  toggleTrackHidden: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)),
      },
    })),

  // ---- clips ----
  addClip: (clip) => {
    get().commit();
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === clip.trackId ? { ...t, clips: [...t.clips, clip] } : t,
        ),
      },
      selectedClipId: clip.id,
    }));
    return clip.id;
  },
  addClipFromAsset: (assetId, opts) => {
    const { mediaAssets, project } = get();
    const asset = mediaAssets.find((a) => a.id === assetId);
    if (!asset) return null;
    const wantType: TrackType = trackTypeForClip(asset.type === 'audio' ? 'audio' : 'video');
    let track =
      (opts?.trackId && project.tracks.find((t) => t.id === opts.trackId)) ||
      project.tracks.find((t) => t.type === wantType && !t.locked);
    if (!track) {
      const id = get().addTrack(wantType);
      track = get().getTrack(id)!;
    }
    const dur = asset.type === 'image' ? 4 : asset.duration || 4;
    const start = opts?.start ?? nextFreeStart(track);
    const clip = clipBase(asset.type === 'audio' ? 'audio' : asset.type === 'image' ? 'image' : 'video', track.id, {
      name: asset.name,
      assetId: asset.id,
      start,
      duration: dur,
      inPoint: 0,
      outPoint: dur,
    });
    return get().addClip(clip);
  },
  addTextClip: (opts) => {
    const { project, currentTime } = get();
    let track = project.tracks.find((t) => t.type === 'text' && !t.locked);
    if (!track) {
      const id = get().addTrack('text');
      track = get().getTrack(id)!;
    }
    const clip = clipBase('text', track.id, {
      name: 'Text',
      start: opts?.start ?? currentTime,
      duration: 3,
      inPoint: 0,
      outPoint: 3,
      text: { ...DEFAULT_TEXT_STYLE, text: opts?.text ?? DEFAULT_TEXT_STYLE.text },
    });
    return get().addClip(clip);
  },
  addOverlayClip: (assetId, opts) => {
    const { mediaAssets, project, currentTime } = get();
    const asset = mediaAssets.find((a) => a.id === assetId);
    if (!asset) return null;
    let track = project.tracks.find((t) => t.type === 'overlay' && !t.locked);
    if (!track) {
      const id = get().addTrack('overlay');
      track = get().getTrack(id)!;
    }
    const dur = asset.type === 'image' ? 4 : asset.duration || 4;
    const clip = clipBase(asset.type === 'image' ? 'sticker' : 'overlay', track.id, {
      name: asset.name,
      assetId: asset.id,
      start: opts?.start ?? currentTime,
      duration: dur,
      inPoint: 0,
      outPoint: dur,
      transform: { ...DEFAULT_TRANSFORM, scale: 0.5 },
    });
    return get().addClip(clip);
  },
  removeClip: (id) => {
    get().commit();
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== id),
        })),
      },
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    }));
  },
  duplicateClip: (id) => {
    const c = get().getClip(id);
    if (!c) return null;
    const copy: Clip = { ...JSON.parse(JSON.stringify(c)), id: nanoid(8), start: c.start + c.duration };
    return get().addClip(copy);
  },
  updateClip: (id, patch) => set((s) => ({ project: withClip(s.project, id, (c) => ({ ...c, ...patch })) })),
  updateTransform: (id, patch) =>
    set((s) => ({ project: withClip(s.project, id, (c) => ({ ...c, transform: { ...c.transform, ...patch } })) })),
  updateAdjustments: (id, patch) =>
    set((s) => ({ project: withClip(s.project, id, (c) => ({ ...c, adjustments: { ...c.adjustments, ...patch } })) })),
  updateAudio: (id, patch) =>
    set((s) => ({ project: withClip(s.project, id, (c) => ({ ...c, audio: { ...c.audio, ...patch } })) })),
  updateText: (id, patch) =>
    set((s) => ({
      project: withClip(s.project, id, (c) => ({ ...c, text: { ...(c.text || DEFAULT_TEXT_STYLE), ...patch } })),
    })),
  updateSpeed: (id, patch) =>
    set((s) => ({
      project: withClip(s.project, id, (c) => {
        const speed = { ...c.speed, ...patch };
        const srcLen = c.outPoint - c.inPoint;
        const duration = c.type === 'image' || c.type === 'text' ? c.duration : srcLen / Math.max(0.1, speed.rate);
        return { ...c, speed, duration };
      }),
    })),
  updateChroma: (id, patch) =>
    set((s) => ({ project: withClip(s.project, id, (c) => ({ ...c, chroma: { ...c.chroma, ...patch } })) })),
  setTransition: (id, t) =>
    set((s) => ({ project: withClip(s.project, id, (c) => ({ ...c, transitionIn: t })) })),

  moveClip: (id, start, trackId) => {
    set((s) => {
      const clip = get().getClip(id);
      if (!clip) return {};
      const targetTrackId = trackId ?? clip.trackId;
      const newStart = Math.max(0, start);
      let tracks = s.project.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) }));
      tracks = tracks.map((t) =>
        t.id === targetTrackId ? { ...t, clips: [...t.clips, { ...clip, start: newStart, trackId: targetTrackId }] } : t,
      );
      return { project: { ...s.project, tracks } };
    });
  },
  trimClip: (id, edge, deltaSeconds) => {
    set((s) => ({
      project: withClip(s.project, id, (c) => {
        const timeBased = !(c.type === 'image' || c.type === 'text');
        const rate = timeBased ? Math.max(0.1, c.speed?.rate ?? 1) : 1;
        if (edge === 'start') {
          // Dragging the left edge: moving the timeline edge by `d` consumes
          // `d * rate` of source from the head (inPoint advances).
          //   d > 0 (drag right): shrink clip, advance inPoint  -> bounded by
          //     duration - MIN and by source remaining ahead (outPoint - inPoint).
          //   d < 0 (drag left):  grow clip, retreat inPoint    -> bounded by
          //     start (can't go past 0) and by inPoint (can't go negative).
          const maxRight = timeBased
            ? Math.min(c.duration - MIN_CLIP_DURATION, (c.outPoint - c.inPoint) / rate)
            : c.duration - MIN_CLIP_DURATION;
          const minLeft = timeBased
            ? -Math.min(c.start, c.inPoint / rate)
            : -c.start;
          const d = clamp(deltaSeconds, minLeft, maxRight);
          const start = c.start + d;
          const duration = c.duration - d;
          const inPoint = timeBased ? c.inPoint + d * rate : c.inPoint;
          return { ...c, start, duration, inPoint };
        } else {
          // Dragging the right edge: extending by `d` consumes `d * rate` more
          // source from the tail (outPoint advances).
          const srcRemaining = timeBased
            ? (c.outPoint - c.inPoint) / rate - c.duration // remaining timeline-seconds of source after current tail
            : Infinity;
          const d = clamp(deltaSeconds, MIN_CLIP_DURATION - c.duration, srcRemaining);
          const duration = c.duration + d;
          const outPoint = timeBased ? c.inPoint + duration * rate : c.outPoint;
          return { ...c, duration, outPoint };
        }
      }),
    }));
  },
  splitClipAt: (time) => {
    const t = time ?? get().currentTime;
    const clip = get().getSelectedClip();
    if (!clip) return;
    if (t <= clip.start + MIN_CLIP_DURATION || t >= clip.start + clip.duration - MIN_CLIP_DURATION) return;
    get().commit();
    const localOffset = t - clip.start;
    const timeBased = !(clip.type === 'image' || clip.type === 'text');
    const rate = timeBased ? Math.max(0.1, clip.speed?.rate ?? 1) : 1;
    // Source position at the cut: timeline offset consumes `localOffset * rate`
    // of source (so the cut respects the clip's speed).
    const cutSource = timeBased ? clip.inPoint + localOffset * rate : clip.inPoint;
    const left: Clip = {
      ...JSON.parse(JSON.stringify(clip)),
      duration: localOffset,
      outPoint: timeBased ? cutSource : clip.outPoint,
    };
    const right: Clip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: nanoid(8),
      start: t,
      duration: clip.duration - localOffset,
      inPoint: timeBased ? cutSource : clip.inPoint,
    };
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((tr) =>
          tr.id === clip.trackId
            ? { ...tr, clips: tr.clips.flatMap((c) => (c.id === clip.id ? [left, right] : [c])) }
            : tr,
        ),
      },
      selectedClipId: right.id,
    }));
  },

  // ---- keyframes ----
  addKeyframe: (clipId, prop, time, value, easing = 'easeInOut') =>
    set((s) => ({
      project: withClip(s.project, clipId, (c) => {
        const list = [...(c.keyframes[prop] || [])];
        list.push({ id: nanoid(6), time, value, easing });
        list.sort((a, b) => a.time - b.time);
        return { ...c, keyframes: { ...c.keyframes, [prop]: list } };
      }),
    })),
  updateKeyframe: (clipId, prop, kfId, patch) =>
    set((s) => ({
      project: withClip(s.project, clipId, (c) => {
        const list = (c.keyframes[prop] || []).map((k) => (k.id === kfId ? { ...k, ...patch } : k));
        list.sort((a, b) => a.time - b.time);
        return { ...c, keyframes: { ...c.keyframes, [prop]: list } };
      }),
    })),
  removeKeyframe: (clipId, prop, kfId) =>
    set((s) => ({
      project: withClip(s.project, clipId, (c) => ({
        ...c,
        keyframes: { ...c.keyframes, [prop]: (c.keyframes[prop] || []).filter((k) => k.id !== kfId) },
      })),
    })),

  // ---- watermark ----
  updateWatermark: (patch) => set((s) => ({ project: { ...s.project, watermark: { ...s.project.watermark, ...patch } } })),
  toggleWatermark: () =>
    set((s) => ({ project: { ...s.project, watermark: { ...s.project.watermark, enabled: !s.project.watermark.enabled } } })),

  // ---- selection / playback / view ----
  selectClip: (id) => set({ selectedClipId: id }),
  selectTrack: (id) => set({ selectedTrackId: id }),
  seek: (time) => set({ currentTime: Math.max(0, time) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setZoom: (z) => set({ zoom: clamp(z, 4, 600) }),
  setSnap: (on) => set({ snapEnabled: on }),
  setPanel: (p) => set({ panel: p }),

  // ---- export ----
  updateExportSettings: (patch) => set((s) => ({ exportSettings: { ...s.exportSettings, ...patch } })),
  setExporting: (on) => set({ isExporting: on, exportProgress: on ? 0 : get().exportProgress }),
  setExportProgress: (p, stage) => set({ exportProgress: p, exportStage: stage ?? get().exportStage }),

  // ---- history ----
  commit: () =>
    set((s) => ({
      _past: [...s._past.slice(-49), JSON.parse(JSON.stringify(s.project))],
      _future: [],
    })),
  undo: () =>
    set((s) => {
      if (!s._past.length) return {};
      const prev = s._past[s._past.length - 1];
      return {
        project: prev,
        _past: s._past.slice(0, -1),
        _future: [JSON.parse(JSON.stringify(s.project)), ...s._future].slice(0, 50),
      };
    }),
  redo: () =>
    set((s) => {
      if (!s._future.length) return {};
      const next = s._future[0];
      return {
        project: next,
        _future: s._future.slice(1),
        _past: [...s._past, JSON.parse(JSON.stringify(s.project))].slice(-50),
      };
    }),
}));
