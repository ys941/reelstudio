import type { AspectRatio, AspectRatioKey, FilterPreset, TransitionType } from '@/types/editor';

export const ASPECT_RATIOS: Record<AspectRatioKey, AspectRatio> = {
  '9:16': { key: '9:16', label: 'Reels / TikTok', width: 1080, height: 1920 },
  '1:1': { key: '1:1', label: 'Square', width: 1080, height: 1080 },
  '4:5': { key: '4:5', label: 'Portrait', width: 1080, height: 1350 },
  '16:9': { key: '16:9', label: 'Landscape', width: 1920, height: 1080 },
  '3:4': { key: '3:4', label: 'Classic', width: 1080, height: 1440 },
  '21:9': { key: '21:9', label: 'Cinematic', width: 2560, height: 1080 },
};

// Pixels-per-second zoom levels for the timeline.
export const ZOOM_LEVELS = [10, 20, 35, 50, 75, 100, 150, 200, 300, 450];
export const DEFAULT_ZOOM = 50;

export const SNAP_THRESHOLD_PX = 8;
export const MIN_CLIP_DURATION = 0.1;

export const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',
  'Verdana',
  'Trebuchet MS',
  'Comic Sans MS',
  'Bebas Neue',
  'Montserrat',
  'Poppins',
];

export const FILTER_PRESETS: { key: FilterPreset; label: string }[] = [
  { key: 'none', label: 'Original' },
  { key: 'vivid', label: 'Vivid' },
  { key: 'warm', label: 'Warm' },
  { key: 'cool', label: 'Cool' },
  { key: 'mono', label: 'Mono' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'noir', label: 'Noir' },
  { key: 'fade', label: 'Fade' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'cinematic', label: 'Cinematic' },
];

export const TRANSITIONS: { key: TransitionType; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'fade', label: 'Fade' },
  { key: 'dissolve', label: 'Dissolve' },
  { key: 'slide', label: 'Slide' },
  { key: 'wipe', label: 'Wipe' },
  { key: 'zoom', label: 'Zoom' },
  { key: 'blur', label: 'Blur' },
  { key: 'glitch', label: 'Glitch' },
  { key: 'whip', label: 'Whip Pan' },
];

export const TRACK_COLORS: Record<string, string> = {
  video: '#3b82f6',
  audio: '#22c55e',
  text: '#f59e0b',
  overlay: '#ec4899',
};
