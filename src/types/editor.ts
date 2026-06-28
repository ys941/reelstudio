// =============================================================================
// ReelStudio — shared type contract.
// Every subsystem (timeline, preview, panels, export) imports from here.
// Treat this file as the source of truth; do not redefine these shapes locally.
// =============================================================================

export type ID = string;

export type ClipType = 'video' | 'image' | 'text' | 'audio' | 'sticker' | 'overlay';
export type TrackType = 'video' | 'audio' | 'text' | 'overlay';

export type AspectRatioKey = '9:16' | '16:9' | '1:1' | '4:5' | '3:4' | '21:9';

export interface AspectRatio {
  key: AspectRatioKey;
  label: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Media assets (imported source files)
// ---------------------------------------------------------------------------
export interface MediaAsset {
  id: ID;
  type: 'video' | 'image' | 'audio';
  name: string;
  url: string; // object URL or remote URL
  duration: number; // seconds (0 for images)
  width: number;
  height: number;
  thumbnail?: string; // data URL
  fileSize?: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Keyframes — animate any numeric property over a clip's local time
// ---------------------------------------------------------------------------
export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Keyframe {
  id: ID;
  time: number; // seconds, relative to clip start
  value: number;
  easing: Easing;
}

// Property names that support keyframing on a clip's transform.
export type KeyframeableProp =
  | 'x'
  | 'y'
  | 'scale'
  | 'rotation'
  | 'opacity';

export type KeyframeMap = Partial<Record<KeyframeableProp, Keyframe[]>>;

// ---------------------------------------------------------------------------
// Transform — position/scale/rotation/opacity in normalized canvas space.
// x/y are normalized offsets from center (-1..1 across the canvas).
// scale 1 = fit, rotation in degrees, opacity 0..1.
// ---------------------------------------------------------------------------
export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  flipH: boolean;
  flipV: boolean;
  // crop in normalized 0..1 of the source (left, top, right, bottom)
  crop?: { left: number; top: number; right: number; bottom: number };
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipH: false,
  flipV: false,
};

// ---------------------------------------------------------------------------
// Filters / color adjustments. All adjustments are -1..1 (0 = neutral)
// except where noted. `preset` applies a named LUT-like look.
// ---------------------------------------------------------------------------
export type FilterPreset =
  | 'none'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'sepia'
  | 'noir'
  | 'fade'
  | 'vintage'
  | 'cinematic';

export interface Adjustments {
  preset: FilterPreset;
  presetStrength: number; // 0..1
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  temperature: number; // -1..1 (blue..orange)
  tint: number; // -1..1 (green..magenta)
  exposure: number; // -1..1
  highlights: number; // -1..1
  shadows: number; // -1..1
  sharpness: number; // 0..1
  blur: number; // 0..1
  vignette: number; // 0..1
  grain: number; // 0..1
  hue: number; // -180..180
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  preset: 'none',
  presetStrength: 1,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
  blur: 0,
  vignette: 0,
  grain: 0,
  hue: 0,
};

// ---------------------------------------------------------------------------
// Chroma key (green screen)
// ---------------------------------------------------------------------------
export interface ChromaKey {
  enabled: boolean;
  color: string; // hex
  similarity: number; // 0..1
  smoothness: number; // 0..1
  spill: number; // 0..1
}

export const DEFAULT_CHROMA: ChromaKey = {
  enabled: false,
  color: '#00ff00',
  similarity: 0.4,
  smoothness: 0.1,
  spill: 0.1,
};

// ---------------------------------------------------------------------------
// Speed control (with optional ramping curve)
// ---------------------------------------------------------------------------
export interface SpeedControl {
  rate: number; // 0.1 .. 100
  curve: { time: number; rate: number }[]; // optional ramp points (normalized 0..1)
  pitchPreserve: boolean;
}

export const DEFAULT_SPEED: SpeedControl = {
  rate: 1,
  curve: [],
  pitchPreserve: true,
};

// ---------------------------------------------------------------------------
// Transitions between adjacent clips on the same track
// ---------------------------------------------------------------------------
export type TransitionType =
  | 'none'
  | 'fade'
  | 'dissolve'
  | 'slide'
  | 'wipe'
  | 'zoom'
  | 'blur'
  | 'glitch'
  | 'whip';

export interface Transition {
  type: TransitionType;
  duration: number; // seconds
}

// ---------------------------------------------------------------------------
// Text styling + animation
// ---------------------------------------------------------------------------
export type TextAnimation =
  | 'none'
  | 'fade'
  | 'pop'
  | 'slideUp'
  | 'slideLeft'
  | 'typewriter'
  | 'bounce'
  | 'wave';

export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number; // px relative to a 1080-tall canvas
  color: string;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  // background pill
  background: { enabled: boolean; color: string; opacity: number; radius: number; padding: number };
  // outline / stroke
  stroke: { enabled: boolean; color: string; width: number };
  // shadow / glow
  shadow: { enabled: boolean; color: string; blur: number; x: number; y: number };
  animationIn: TextAnimation;
  animationOut: TextAnimation;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: 'Your text',
  fontFamily: 'Inter',
  fontSize: 72,
  color: '#ffffff',
  fontWeight: 700,
  italic: false,
  underline: false,
  align: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  background: { enabled: false, color: '#000000', opacity: 0.5, radius: 12, padding: 16 },
  stroke: { enabled: false, color: '#000000', width: 4 },
  shadow: { enabled: true, color: '#000000', blur: 12, x: 0, y: 4 },
  animationIn: 'fade',
  animationOut: 'fade',
};

// ---------------------------------------------------------------------------
// Audio properties (for audio clips & video clip audio)
// ---------------------------------------------------------------------------
export interface AudioProps {
  volume: number; // 0..2
  muted: boolean;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
}

export const DEFAULT_AUDIO: AudioProps = {
  volume: 1,
  muted: false,
  fadeIn: 0,
  fadeOut: 0,
};

// ---------------------------------------------------------------------------
// Clip — the universal timeline item. Discriminated by `type`.
// `start` is the position on the timeline; `inPoint`/`outPoint` slice the
// source. `duration` is always (outPoint - inPoint) / speed for media.
// ---------------------------------------------------------------------------
export interface Clip {
  id: ID;
  type: ClipType;
  trackId: ID;
  assetId?: ID; // for video/image/audio/sticker/overlay backed by media
  name: string;

  // timeline placement (seconds)
  start: number;
  duration: number;

  // source trim (seconds, for time-based media)
  inPoint: number;
  outPoint: number;

  transform: Transform;
  adjustments: Adjustments;
  chroma: ChromaKey;
  speed: SpeedControl;
  audio: AudioProps;
  keyframes: KeyframeMap;

  // transition that plays going INTO this clip
  transitionIn: Transition;

  // text-only
  text?: TextStyle;

  // sticker/overlay extras
  blendMode?: GlobalCompositeOperation;

  locked: boolean;
  hidden: boolean;
  color?: string; // clip chip color override
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------
export interface Track {
  id: ID;
  type: TrackType;
  name: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  height: number;
}

// ---------------------------------------------------------------------------
// Watermark — global overlay burned over the whole composition.
// ---------------------------------------------------------------------------
export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface Watermark {
  enabled: boolean;
  mode: 'image' | 'text';
  // image
  imageUrl: string | null;
  imageName?: string;
  // text
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  // shared
  position: WatermarkPosition;
  opacity: number; // 0..1
  scale: number; // 0..2 (image) — relative to canvas width
  rotation: number; // degrees
  margin: number; // px @1080
  tiled: boolean; // repeat across the frame
  tileGap: number; // px @1080 when tiled
}

export const DEFAULT_WATERMARK: Watermark = {
  enabled: false,
  mode: 'text',
  imageUrl: null,
  text: '@yourbrand',
  fontFamily: 'Inter',
  fontSize: 40,
  color: '#ffffff',
  position: 'bottom-right',
  opacity: 0.6,
  scale: 0.18,
  rotation: 0,
  margin: 48,
  tiled: false,
  tileGap: 320,
};

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------
export interface Project {
  id: ID;
  name: string;
  aspectRatio: AspectRatio;
  fps: number;
  backgroundColor: string;
  tracks: Track[];
  watermark: Watermark;
}

// ---------------------------------------------------------------------------
// Export settings
// ---------------------------------------------------------------------------
export type ExportFormat = 'mp4' | 'webm' | 'gif';
export type ExportQuality = 'low' | 'medium' | 'high' | 'max';

export interface ExportSettings {
  format: ExportFormat;
  quality: ExportQuality;
  fps: number;
  resolutionScale: number; // 0.5 / 1 / 2 of project height
  includeWatermark: boolean;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4',
  quality: 'high',
  fps: 30,
  resolutionScale: 1,
  includeWatermark: true,
};

// ---------------------------------------------------------------------------
// Active right-hand panel
// ---------------------------------------------------------------------------
export type PanelKey =
  | 'media'
  | 'audio'
  | 'text'
  | 'overlay'
  | 'sticker'
  | 'effects'
  | 'adjust'
  | 'crop'
  | 'speed'
  | 'transition'
  | 'watermark'
  | 'export';
