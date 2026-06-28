// =============================================================================
// Shared render math — used by BOTH the live preview and the export pipeline so
// they produce identical frames. Pure functions only (no DOM dependency beyond
// canvas filter strings).
// =============================================================================

import { easeValue } from '@/lib/utils';
import type {
  Adjustments,
  ChromaKey,
  Clip,
  FilterPreset,
  Keyframe,
  KeyframeableProp,
  Transform,
  Watermark,
} from '@/types/editor';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v || '00ff00', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Chroma-key (green-screen) keying applied IN PLACE on a frame's pixel buffer.
 * Pure: operates only on the Uint8ClampedArray, so both the preview canvas and
 * the export pipeline can call it on their own ImageData. Pixels close to the
 * key colour become transparent; a smoothness band gives a soft edge, and spill
 * suppression desaturates the key channel near matched edges.
 */
export function applyChromaKey(data: Uint8ClampedArray, chroma: ChromaKey): void {
  if (!chroma?.enabled) return;
  const key = hexToRgb(chroma.color);
  const MAX = 441.673; // sqrt(255^2 * 3)
  const sim = chroma.similarity * MAX;
  const smooth = Math.max(1, chroma.smoothness * MAX);
  const spill = chroma.spill;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - key.r;
    const dg = data[i + 1] - key.g;
    const db = data[i + 2] - key.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < sim) {
      data[i + 3] = 0;
    } else if (dist < sim + smooth) {
      data[i + 3] = Math.round(data[i + 3] * ((dist - sim) / smooth));
    }
    // Spill suppression: if the keyed channel still dominates on a kept pixel,
    // pull it down toward the average of the other two channels.
    if (spill > 0 && data[i + 3] > 0) {
      const avg = (data[i] + data[i + 2]) / 2;
      if (data[i + 1] > avg) data[i + 1] = Math.round(data[i + 1] + (avg - data[i + 1]) * spill);
    }
  }
}

/** Clip local time (0-based) at a given timeline time, accounting for speed. */
export function clipLocalTime(clip: Clip, timelineTime: number): number {
  const t = timelineTime - clip.start;
  return Math.max(0, t);
}

/** Source playback time inside the asset for a video clip at timelineTime. */
export function clipSourceTime(clip: Clip, timelineTime: number): number {
  const local = clipLocalTime(clip, timelineTime);
  const rate = clip.speed?.rate ?? 1;
  return clip.inPoint + local * rate;
}

/** Sample a keyframe track at local time. Returns fallback if no keyframes. */
export function sampleKeyframes(kfs: Keyframe[] | undefined, time: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  if (kfs.length === 1) return kfs[0].value;
  if (time <= kfs[0].time) return kfs[0].value;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1;
      const t = easeValue((time - a.time) / span, b.easing);
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

/** Resolve a clip's effective transform at a timeline time (keyframes applied). */
export function resolveTransform(clip: Clip, timelineTime: number): Transform {
  const local = clipLocalTime(clip, timelineTime);
  const base = clip.transform;
  const kf = clip.keyframes || {};
  const pick = (prop: KeyframeableProp, fb: number) => sampleKeyframes(kf[prop], local, fb);
  return {
    ...base,
    x: pick('x', base.x),
    y: pick('y', base.y),
    scale: pick('scale', base.scale),
    rotation: pick('rotation', base.rotation),
    opacity: pick('opacity', base.opacity),
  };
}

/** Per-preset base CSS/canvas filter functions. */
function presetFilter(preset: FilterPreset, strength: number): string {
  const s = Math.max(0, Math.min(1, strength));
  const mix = (val: number) => 1 + (val - 1) * s;
  switch (preset) {
    case 'vivid':
      return `saturate(${mix(1.45)}) contrast(${mix(1.1)})`;
    case 'warm':
      return `sepia(${0.25 * s}) saturate(${mix(1.15)})`;
    case 'cool':
      return `hue-rotate(${-12 * s}deg) saturate(${mix(1.1)})`;
    case 'mono':
      return `grayscale(${s})`;
    case 'sepia':
      return `sepia(${0.85 * s})`;
    case 'noir':
      return `grayscale(${s}) contrast(${mix(1.35)})`;
    case 'fade':
      return `contrast(${mix(0.82)}) brightness(${mix(1.08)}) saturate(${mix(0.85)})`;
    case 'vintage':
      return `sepia(${0.4 * s}) contrast(${mix(1.1)}) saturate(${mix(1.2)})`;
    case 'cinematic':
      return `contrast(${mix(1.18)}) saturate(${mix(1.08)}) brightness(${mix(0.98)})`;
    default:
      return '';
  }
}

/**
 * Build a canvas/CSS filter string from adjustments. Works for both
 * `ctx.filter` (canvas) and CSS `filter`. Note: vignette/grain/tint are drawn
 * separately by the renderer (not expressible as filter functions).
 */
export function buildFilterString(adj: Adjustments): string {
  const parts: string[] = [];
  const preset = presetFilter(adj.preset, adj.presetStrength);
  if (preset) parts.push(preset);

  const brightness = 1 + adj.brightness * 0.6 + adj.exposure * 0.5;
  const contrast = 1 + adj.contrast * 0.6;
  const saturate = 1 + adj.saturation * 0.8;

  if (brightness !== 1) parts.push(`brightness(${brightness.toFixed(3)})`);
  if (contrast !== 1) parts.push(`contrast(${contrast.toFixed(3)})`);
  if (saturate !== 1) parts.push(`saturate(${saturate.toFixed(3)})`);
  if (adj.hue) parts.push(`hue-rotate(${adj.hue}deg)`);
  if (adj.temperature) parts.push(`sepia(${Math.max(0, adj.temperature * 0.3).toFixed(3)})`);
  if (adj.blur > 0) parts.push(`blur(${(adj.blur * 12).toFixed(1)}px)`);

  return parts.join(' ').trim();
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** "cover" fit: fill the frame, cropping overflow. */
export function coverRect(frameW: number, frameH: number, srcW: number, srcH: number): Rect {
  if (!srcW || !srcH) return { x: 0, y: 0, w: frameW, h: frameH };
  const scale = Math.max(frameW / srcW, frameH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

/** "contain" fit: fit entirely inside, letterboxed. */
export function containRect(frameW: number, frameH: number, srcW: number, srcH: number): Rect {
  if (!srcW || !srcH) return { x: 0, y: 0, w: frameW, h: frameH };
  const scale = Math.min(frameW / srcW, frameH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h };
}

/**
 * Resolve the source sub-rectangle (in source pixels) selected by a clip's crop,
 * plus the destination rect that "cover"- or "contain"-fits that cropped region
 * into the frame. crop edges are normalized 0..1 fractions cut from each side.
 * Used by both preview and export so a crop renders identically.
 */
export function cropRects(
  frameW: number,
  frameH: number,
  srcW: number,
  srcH: number,
  crop: Transform['crop'] | undefined,
  fit: 'cover' | 'contain' = 'cover',
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const cl = Math.min(0.49, Math.max(0, crop?.left ?? 0));
  const ct = Math.min(0.49, Math.max(0, crop?.top ?? 0));
  const cr = Math.min(0.49, Math.max(0, crop?.right ?? 0));
  const cb = Math.min(0.49, Math.max(0, crop?.bottom ?? 0));
  const sx = cl * srcW;
  const sy = ct * srcH;
  const sw = Math.max(1, (1 - cl - cr) * srcW);
  const sh = Math.max(1, (1 - ct - cb) * srcH);
  const dest = fit === 'cover' ? coverRect(frameW, frameH, sw, sh) : containRect(frameW, frameH, sw, sh);
  return { sx, sy, sw, sh, dx: dest.x, dy: dest.y, dw: dest.w, dh: dest.h };
}

/** True when a clip has a non-trivial crop applied. */
export function hasCrop(crop: Transform['crop'] | undefined): boolean {
  if (!crop) return false;
  return (crop.left || 0) + (crop.right || 0) + (crop.top || 0) + (crop.bottom || 0) > 0.0001;
}

/**
 * Fade in/out multiplier (0..1) for a clip's opacity envelope, based on its
 * audio fade settings reused for visual fades + transitionIn duration.
 */
export function transitionOpacity(clip: Clip, timelineTime: number): number {
  const local = clipLocalTime(clip, timelineTime);
  const t = clip.transitionIn;
  let o = 1;
  if (t && t.type !== 'none' && t.duration > 0 && local < t.duration) {
    o = local / t.duration;
  }
  return Math.max(0, Math.min(1, o));
}

/** Compute watermark draw position (top-left origin) for given content size. */
export function watermarkPosition(
  wm: Watermark,
  frameW: number,
  frameH: number,
  contentW: number,
  contentH: number,
): { x: number; y: number } {
  const scaleRef = frameH / 1080;
  const m = wm.margin * scaleRef;
  // 'center' is a single token meaning center on both axes; everything else is
  // 'vertical-horizontal' (e.g. 'top-right', 'center-left', 'bottom-center').
  const parts = wm.position.split('-');
  const v = parts.length === 1 ? 'center' : parts[0];
  const h = parts.length === 1 ? 'center' : parts[1];
  let x = m;
  let y = m;
  if (h === 'center') x = (frameW - contentW) / 2;
  else if (h === 'right') x = frameW - contentW - m;
  else x = m;
  if (v === 'center') y = (frameH - contentH) / 2;
  else if (v === 'bottom') y = frameH - contentH - m;
  else y = m;
  return { x, y };
}
