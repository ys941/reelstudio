// =============================================================================
// ReelStudio export engine.
//
// Primary path: render the timeline in REAL TIME onto an offscreen <canvas>,
// capture it with canvas.captureStream(fps), mix all clip audio through the Web
// Audio API into a single MediaStreamAudioDestinationNode, combine the video +
// audio tracks into one MediaStream, and record it with MediaRecorder.
//
// The drawing math is a faithful re-implementation of the live preview
// (CanvasPlayer.tsx) using the SAME shared helpers from '@/lib/render', so the
// exported frames match what the user sees.
//
// GIF path: lazily load ffmpeg.wasm to convert the captured webm to a GIF. This
// is wrapped in try/catch so a failure to load ffmpeg never breaks the build or
// the (more common) video export.
// =============================================================================

import { clamp } from '@/lib/utils';
import {
  applyChromaKey,
  buildFilterString,
  clipLocalTime,
  clipSourceTime,
  cropRects,
  resolveTransform,
  transitionOpacity,
  watermarkPosition,
} from '@/lib/render';
import type { ChromaKey } from '@/types/editor';
import type {
  Clip,
  ExportQuality,
  ExportSettings,
  MediaAsset,
  Project,
  TextStyle,
  Track,
  Watermark,
} from '@/types/editor';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface ExportOptions {
  project: Project;
  assets: MediaAsset[];
  settings: ExportSettings;
  onProgress: (p: number, stage: string) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

/** Compute the rendered output dimensions (rounded to even numbers). */
export function outputDimensions(project: Project, settings: ExportSettings): { width: number; height: number } {
  const scale = settings.resolutionScale || 1;
  const round2 = (n: number) => {
    const r = Math.round(n);
    return r % 2 === 0 ? r : r + 1;
  };
  return {
    width: Math.max(2, round2(project.aspectRatio.width * scale)),
    height: Math.max(2, round2(project.aspectRatio.height * scale)),
  };
}

/** Total timeline duration from the project tracks (independent of the store). */
export function projectDuration(project: Project): number {
  let max = 0;
  project.tracks.forEach((t) => {
    t.clips.forEach((c) => {
      max = Math.max(max, c.start + c.duration);
    });
  });
  return max;
}

function bitrateForQuality(q: ExportQuality): number {
  switch (q) {
    case 'low':
      return 2_000_000;
    case 'medium':
      return 5_000_000;
    case 'high':
      return 8_000_000;
    case 'max':
      return 16_000_000;
    default:
      return 8_000_000;
  }
}

function pickMimeType(format: ExportSettings['format']): { mimeType: string; ext: string; isMp4: boolean } {
  const canRecord = (t: string) =>
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(t);

  // GIF & WebM both record to a webm container first; GIF is transcoded later.
  if (format === 'mp4') {
    const mp4Candidates = ['video/mp4;codecs=avc1', 'video/mp4'];
    for (let i = 0; i < mp4Candidates.length; i++) {
      if (canRecord(mp4Candidates[i])) return { mimeType: mp4Candidates[i], ext: 'mp4', isMp4: true };
    }
  }
  const webmCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (let i = 0; i < webmCandidates.length; i++) {
    if (canRecord(webmCandidates[i])) return { mimeType: webmCandidates[i], ext: 'webm', isMp4: false };
  }
  // Last resort — let the browser choose its default.
  return { mimeType: '', ext: 'webm', isMp4: false };
}

// ---------------------------------------------------------------------------
// Offscreen media pool (independent of the preview's pool)
// ---------------------------------------------------------------------------
type ExportEntry =
  | { type: 'video'; el: HTMLVideoElement; asset: MediaAsset }
  | { type: 'image'; el: HTMLImageElement; asset: MediaAsset }
  | { type: 'audio'; el: HTMLAudioElement; asset: MediaAsset };

interface PoolMap {
  ids: string[];
  byId: Record<string, ExportEntry>;
}

function getEntry(pool: PoolMap, id: string | undefined): ExportEntry | undefined {
  if (!id) return undefined;
  return pool.byId[id];
}

/** Determine which assets are actually referenced by the project. */
function usedAssetIds(project: Project): string[] {
  const out: string[] = [];
  project.tracks.forEach((t) => {
    t.clips.forEach((c) => {
      if (c.assetId && out.indexOf(c.assetId) === -1) out.push(c.assetId);
    });
  });
  return out;
}

async function buildPool(project: Project, assets: MediaAsset[]): Promise<PoolMap> {
  const wanted = usedAssetIds(project);
  const pool: PoolMap = { ids: [], byId: {} };
  const loaders: Promise<void>[] = [];

  wanted.forEach((id) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;

    if (asset.type === 'video') {
      const el = document.createElement('video');
      // NOTE: not muted — we need its audio for the mix. crossOrigin so the
      // canvas stays untainted for captureStream.
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.playsInline = true;
      el.loop = false;
      el.src = asset.url;
      el.style.position = 'absolute';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      pool.ids.push(id);
      pool.byId[id] = { type: 'video', el, asset };
      loaders.push(waitMediaReady(el));
    } else if (asset.type === 'audio') {
      const el = document.createElement('audio');
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.loop = false;
      el.src = asset.url;
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      pool.ids.push(id);
      pool.byId[id] = { type: 'audio', el, asset };
      loaders.push(waitMediaReady(el));
    } else {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.decoding = 'async';
      el.src = asset.url;
      pool.ids.push(id);
      pool.byId[id] = { type: 'image', el, asset };
      loaders.push(waitImageReady(el));
    }
  });

  // Best-effort: don't block forever if one source is slow / fails.
  await Promise.all(loaders.map((p) => p.catch(() => undefined)));
  return pool;
}

function waitMediaReady(el: HTMLMediaElement): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('loadeddata', finish);
      el.removeEventListener('canplay', finish);
      el.removeEventListener('error', finish);
      resolve();
    };
    el.addEventListener('loadeddata', finish);
    el.addEventListener('canplay', finish);
    el.addEventListener('error', finish);
    // Safety timeout.
    window.setTimeout(finish, 8000);
  });
}

function waitImageReady(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth) {
      resolve();
      return;
    }
    const finish = () => {
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      resolve();
    };
    img.addEventListener('load', finish);
    img.addEventListener('error', finish);
    window.setTimeout(finish, 8000);
  });
}

function destroyPool(pool: PoolMap) {
  pool.ids.forEach((id) => {
    const entry = pool.byId[id];
    if (!entry) return;
    try {
      if (entry.type === 'video' || entry.type === 'audio') {
        entry.el.pause();
        entry.el.removeAttribute('src');
        entry.el.load();
        entry.el.remove();
      } else {
        entry.el.src = '';
      }
    } catch {
      /* ignore */
    }
  });
}

// ---------------------------------------------------------------------------
// Audio mixing — route each video/audio element through the AudioContext into a
// single MediaStreamAudioDestinationNode. Returns null if mixing isn't possible.
// ---------------------------------------------------------------------------
interface AudioMix {
  ctx: AudioContext;
  dest: MediaStreamAudioDestinationNode;
  gains: Record<string, GainNode>; // assetId -> per-source gain
}

function buildAudioMix(pool: PoolMap): AudioMix | null {
  try {
    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const dest = ctx.createMediaStreamDestination();
    const gains: Record<string, GainNode> = {};

    pool.ids.forEach((id) => {
      const entry = pool.byId[id];
      if (!entry || entry.type === 'image') return;
      try {
        const source = ctx.createMediaElementSource(entry.el);
        const gain = ctx.createGain();
        gain.gain.value = 0; // driven per-frame
        source.connect(gain);
        gain.connect(dest);
        gains[id] = gain;
      } catch {
        /* a source can only be wired once; ignore failures per element */
      }
    });

    return { ctx, dest, gains };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Frame drawing — mirrors CanvasPlayer's draw pipeline exactly.
// ---------------------------------------------------------------------------
interface WmImageCache {
  url: string;
  img: HTMLImageElement;
  loaded: boolean;
}

function drawRank(c: Clip): number {
  if (c.type === 'text') return 2;
  if (c.type === 'overlay' || c.type === 'sticker') return 1;
  return 0;
}

function activeClipsAt(project: Project, time: number): Clip[] {
  const out: Clip[] = [];
  project.tracks.forEach((t) => {
    if (t.hidden) return;
    t.clips.forEach((c) => {
      if (c.hidden) return;
      if (time >= c.start && time < c.start + c.duration) out.push(c);
    });
  });
  return out;
}

interface DrawState {
  wmImageRef: { current: WmImageCache | null };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  project: Project,
  pool: PoolMap,
  settings: ExportSettings,
  state: DrawState,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = project.backgroundColor || '#000000';
  ctx.fillRect(0, 0, W, H);

  const active = activeClipsAt(project, t);

  for (let i = project.tracks.length - 1; i >= 0; i--) {
    const track = project.tracks[i];
    if (track.hidden) continue;
    const clips = active.filter((c) => c.trackId === track.id);
    const ordered = clips.slice().sort((a, b) => drawRank(a) - drawRank(b));
    ordered.forEach((clip) => drawClip(ctx, clip, track, t, pool, W, H));
  }

  if (settings.includeWatermark && project.watermark.enabled) {
    drawWatermark(ctx, project.watermark, W, H, state.wmImageRef);
  }
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  _track: Track,
  t: number,
  pool: PoolMap,
  W: number,
  H: number,
) {
  if (clip.type === 'text' && clip.text) {
    drawText(ctx, clip, clip.text, t, W, H);
    return;
  }
  const entry = getEntry(pool, clip.assetId);
  if (!entry) return;
  if (clip.type === 'video' || clip.type === 'image') {
    drawBaseMedia(ctx, clip, entry, t, W, H);
  } else if (clip.type === 'overlay' || clip.type === 'sticker') {
    drawPip(ctx, clip, entry, t, W, H);
  }
}

// Reusable offscreen canvas for chroma keying during export.
let chromaCanvas: HTMLCanvasElement | null = null;

function keyedDrawable(src: CanvasImageSource, w: number, h: number, chroma?: ChromaKey): CanvasImageSource {
  if (!chroma?.enabled || w <= 0 || h <= 0) return src;
  if (!chromaCanvas) chromaCanvas = document.createElement('canvas');
  const c = chromaCanvas;
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  if (!cx) return src;
  cx.clearRect(0, 0, w, h);
  try {
    cx.drawImage(src, 0, 0, w, h);
    const img = cx.getImageData(0, 0, w, h);
    applyChromaKey(img.data, chroma);
    cx.putImageData(img, 0, 0);
  } catch {
    return src;
  }
  return c;
}

function getDrawable(entry: ExportEntry): { src: CanvasImageSource; w: number; h: number } | null {
  if (entry.type === 'video') {
    const v = entry.el;
    if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) return null;
    return { src: v, w: v.videoWidth, h: v.videoHeight };
  }
  if (entry.type === 'image') {
    const img = entry.el;
    if (!img.complete || !img.naturalWidth) return null;
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  }
  return null;
}

function drawBaseMedia(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  entry: ExportEntry,
  t: number,
  W: number,
  H: number,
) {
  const d = getDrawable(entry);
  if (!d) return;

  const tf = resolveTransform(clip, t);
  const c = cropRects(W, H, d.w, d.h, clip.transform.crop, 'cover');

  ctx.save();
  ctx.filter = buildFilterString(clip.adjustments) || 'none';
  ctx.globalAlpha = clamp(tf.opacity, 0, 1) * transitionOpacity(clip, t);

  ctx.translate(W / 2 + (tf.x * W) / 2, H / 2 + (tf.y * H) / 2);
  ctx.rotate((tf.rotation * Math.PI) / 180);
  const sx = (tf.flipH ? -1 : 1) * tf.scale;
  const sy = (tf.flipV ? -1 : 1) * tf.scale;
  ctx.scale(sx, sy);

  try {
    const src = keyedDrawable(d.src, d.w, d.h, clip.chroma);
    ctx.drawImage(src, c.sx, c.sy, c.sw, c.sh, c.dx - W / 2, c.dy - H / 2, c.dw, c.dh);
  } catch {
    /* element not ready */
  }
  ctx.restore();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}

function drawPip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  entry: ExportEntry,
  t: number,
  W: number,
  H: number,
) {
  const d = getDrawable(entry);
  if (!d) return;

  const tf = resolveTransform(clip, t);
  const cr = clip.transform.crop;
  const csx = (cr?.left ?? 0) * d.w;
  const csy = (cr?.top ?? 0) * d.h;
  const csw = Math.max(1, (1 - (cr?.left ?? 0) - (cr?.right ?? 0)) * d.w);
  const csh = Math.max(1, (1 - (cr?.top ?? 0) - (cr?.bottom ?? 0)) * d.h);
  const aspect = csw / csh;
  let baseW = W;
  let baseH = W / aspect;
  if (baseH > H) {
    baseH = H;
    baseW = H * aspect;
  }
  const w = baseW * tf.scale;
  const h = baseH * tf.scale;

  ctx.save();
  ctx.filter = buildFilterString(clip.adjustments) || 'none';
  ctx.globalAlpha = clamp(tf.opacity, 0, 1) * transitionOpacity(clip, t);
  if (clip.blendMode) ctx.globalCompositeOperation = clip.blendMode;

  ctx.translate(W / 2 + (tf.x * W) / 2, H / 2 + (tf.y * H) / 2);
  ctx.rotate((tf.rotation * Math.PI) / 180);
  ctx.scale(tf.flipH ? -1 : 1, tf.flipV ? -1 : 1);

  try {
    const src = keyedDrawable(d.src, d.w, d.h, clip.chroma);
    ctx.drawImage(src, csx, csy, csw, csh, -w / 2, -h / 2, w, h);
  } catch {
    /* ignore */
  }
  ctx.restore();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---- text (mirrors CanvasPlayer.drawText) ----
function drawText(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  style: TextStyle,
  t: number,
  W: number,
  H: number,
) {
  const local = clipLocalTime(clip, t);
  const anim = computeTextAnim(clip, style, local, W, H);
  if (anim.alpha <= 0) return;

  const tf = resolveTransform(clip, t);
  const scaleRef = H / 1080;
  const fontSize = style.fontSize * scaleRef;
  const lineHeight = fontSize * style.lineHeight;
  const weight = style.italic ? `italic ${style.fontWeight}` : `${style.fontWeight}`;
  const font = `${weight} ${fontSize}px ${style.fontFamily}, Inter, system-ui, sans-serif`;
  const letterSpacing = style.letterSpacing * scaleRef;

  const fullLines = style.text.split('\n');
  const lines = anim.revealChars == null ? fullLines : revealText(fullLines, anim.revealChars);

  ctx.save();
  ctx.globalAlpha = clamp(tf.opacity, 0, 1) * anim.alpha * transitionOpacity(clip, t);

  ctx.translate(W / 2 + (tf.x * W) / 2, H / 2 + (tf.y * H) / 2 + anim.offsetY);
  ctx.rotate((tf.rotation * Math.PI) / 180);
  ctx.scale(tf.scale * anim.scale, tf.scale * anim.scale);

  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = style.align as CanvasTextAlign;
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${letterSpacing}px`;
  } catch {
    /* ignore */
  }

  const measured = lines.map((l) => measureLine(ctx, l, letterSpacing));
  const blockW = Math.max(1, ...measured.map((m) => m.width));
  const blockH = lineHeight * lines.length;
  const startY = -blockH / 2 + lineHeight / 2;

  const anchorX = style.align === 'left' ? -blockW / 2 : style.align === 'right' ? blockW / 2 : 0;

  if (style.background.enabled) {
    const pad = style.background.padding * scaleRef;
    ctx.save();
    ctx.globalAlpha *= clamp(style.background.opacity, 0, 1);
    ctx.fillStyle = style.background.color;
    roundRect(
      ctx,
      -blockW / 2 - pad,
      -blockH / 2 - pad,
      blockW + pad * 2,
      blockH + pad * 2,
      style.background.radius * scaleRef,
    );
    ctx.fill();
    ctx.restore();
  }

  if (style.shadow.enabled) {
    ctx.shadowColor = style.shadow.color;
    ctx.shadowBlur = style.shadow.blur * scaleRef;
    ctx.shadowOffsetX = style.shadow.x * scaleRef;
    ctx.shadowOffsetY = style.shadow.y * scaleRef;
  }

  lines.forEach((line, idx) => {
    const y = startY + idx * lineHeight;
    if (style.stroke.enabled && style.stroke.width > 0) {
      ctx.lineWidth = style.stroke.width * scaleRef;
      ctx.strokeStyle = style.stroke.color;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, anchorX, y);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(line, anchorX, y);
    if (style.underline) {
      const m = measured[idx];
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      const ux = style.align === 'left' ? anchorX : style.align === 'right' ? anchorX - m.width : -m.width / 2;
      const uy = y + fontSize * 0.42;
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(ux + m.width, uy);
      ctx.stroke();
      ctx.restore();
    }
  });

  ctx.restore();
  ctx.globalAlpha = 1;
}

function measureLine(ctx: CanvasRenderingContext2D, line: string, letterSpacing: number) {
  const m = ctx.measureText(line);
  let width = m.width;
  if (!('letterSpacing' in ctx) && letterSpacing) width += letterSpacing * Math.max(0, line.length - 1);
  return { width };
}

function revealText(lines: string[], chars: number): string[] {
  let remaining = Math.max(0, Math.floor(chars));
  const out: string[] = [];
  lines.forEach((line) => {
    if (remaining <= 0) {
      out.push('');
      return;
    }
    if (remaining >= line.length) {
      out.push(line);
      remaining -= line.length + 1;
    } else {
      out.push(line.slice(0, remaining));
      remaining = 0;
    }
  });
  return out;
}

interface TextAnim {
  alpha: number;
  scale: number;
  offsetY: number;
  revealChars: number | null;
}

function computeTextAnim(clip: Clip, style: TextStyle, local: number, _W: number, H: number): TextAnim {
  const dur = clip.duration;
  const inDur = Math.min(0.5, dur * 0.4);
  const outDur = Math.min(0.5, dur * 0.4);
  const fromEnd = dur - local;

  const res: TextAnim = { alpha: 1, scale: 1, offsetY: 0, revealChars: null };

  if (local < inDur && inDur > 0) {
    const p = clamp(local / inDur, 0, 1);
    const e = easeOutBack(p);
    switch (style.animationIn) {
      case 'pop':
        res.scale = 0.6 + 0.4 * e;
        res.alpha = clamp(p * 1.5, 0, 1);
        break;
      case 'bounce':
        res.scale = 0.6 + 0.4 * e;
        res.offsetY = (1 - easeOut(p)) * -0.06 * H;
        res.alpha = clamp(p * 1.5, 0, 1);
        break;
      case 'slideUp':
        res.offsetY = (1 - easeOut(p)) * 0.15 * H;
        res.alpha = p;
        break;
      case 'slideLeft':
        res.offsetY = 0;
        res.alpha = p;
        break;
      case 'wave':
        res.alpha = p;
        res.offsetY = Math.sin(local * 8) * 0.01 * H * (1 - p);
        break;
      case 'typewriter': {
        const total = style.text.length;
        const speed = total / Math.max(0.2, dur * 0.6);
        res.revealChars = Math.min(total, local * speed);
        res.alpha = 1;
        break;
      }
      case 'none':
        res.alpha = 1;
        break;
      case 'fade':
      default:
        res.alpha = p;
    }
  }

  if (fromEnd < outDur && outDur > 0 && local >= inDur) {
    const p = clamp(fromEnd / outDur, 0, 1);
    switch (style.animationOut) {
      case 'pop':
        res.scale = 0.6 + 0.4 * p;
        res.alpha = Math.min(res.alpha, p);
        break;
      case 'slideUp':
        res.offsetY = (1 - p) * -0.15 * H;
        res.alpha = Math.min(res.alpha, p);
        break;
      case 'none':
        break;
      case 'fade':
      default:
        res.alpha = Math.min(res.alpha, p);
    }
  }

  return res;
}

function easeOut(t: number) {
  return t * (2 - t);
}
function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ---- watermark (mirrors CanvasPlayer.drawWatermark) ----
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  wm: Watermark,
  W: number,
  H: number,
  imageRef: { current: WmImageCache | null },
) {
  const scaleRef = H / 1080;
  ctx.save();
  ctx.globalAlpha = clamp(wm.opacity, 0, 1);

  if (wm.mode === 'image' && wm.imageUrl) {
    if (!imageRef.current || imageRef.current.url !== wm.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const ref: WmImageCache = { url: wm.imageUrl, img, loaded: false };
      img.onload = () => {
        ref.loaded = true;
      };
      img.src = wm.imageUrl;
      imageRef.current = ref;
    }
    const cache = imageRef.current;
    if (!cache || !cache.loaded || !cache.img.naturalWidth) {
      ctx.restore();
      return;
    }
    const cw = wm.scale * W;
    const ch = (cw / cache.img.naturalWidth) * cache.img.naturalHeight;
    drawWmContent(ctx, wm, W, H, cw, ch, scaleRef, (cx, cy) => {
      ctx.drawImage(cache.img, cx, cy, cw, ch);
    });
  } else if (wm.mode === 'text' && wm.text) {
    const fontSize = wm.fontSize * scaleRef;
    ctx.font = `600 ${fontSize}px ${wm.fontFamily}, Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = wm.color;
    const m = ctx.measureText(wm.text);
    const cw = m.width;
    const ch = fontSize * 1.2;
    drawWmContent(ctx, wm, W, H, cw, ch, scaleRef, (cx, cy) => {
      ctx.fillStyle = wm.color;
      ctx.fillText(wm.text, cx, cy);
    });
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawWmContent(
  ctx: CanvasRenderingContext2D,
  wm: Watermark,
  W: number,
  H: number,
  cw: number,
  ch: number,
  scaleRef: number,
  paint: (cx: number, cy: number) => void,
) {
  const rot = (wm.rotation * Math.PI) / 180;

  if (wm.tiled) {
    const gap = wm.tileGap * scaleRef;
    // Guard against a non-positive step (e.g. negative tileGap or near-zero
    // content size), which would make these loops never advance and hang export.
    const stepX = Math.max(1, cw + gap);
    const stepY = Math.max(1, ch + gap);
    for (let y = -ch; y < H + ch; y += stepY) {
      for (let x = -cw; x < W + cw; x += stepX) {
        ctx.save();
        ctx.translate(x + cw / 2, y + ch / 2);
        ctx.rotate(rot);
        paint(-cw / 2, -ch / 2);
        ctx.restore();
      }
    }
    return;
  }

  const pos = watermarkPosition(wm, W, H, cw, ch);
  ctx.save();
  ctx.translate(pos.x + cw / 2, pos.y + ch / 2);
  ctx.rotate(rot);
  paint(-cw / 2, -ch / 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Audio playback driving (per frame) — mirrors CanvasPlayer.syncAudio but
// routes volume through the mix gain nodes instead of element.volume.
// ---------------------------------------------------------------------------
function fadeEnvelope(clip: Clip, t: number): number {
  const local = clipLocalTime(clip, t);
  const fadeIn = clip.audio.fadeIn;
  const fadeOut = clip.audio.fadeOut;
  const fromEnd = clip.duration - local;
  let g = 1;
  if (fadeIn > 0 && local < fadeIn) g = Math.min(g, local / fadeIn);
  if (fadeOut > 0 && fromEnd < fadeOut) g = Math.min(g, Math.max(0, fromEnd) / fadeOut);
  return clamp(g, 0, 1);
}

function driveAudio(project: Project, pool: PoolMap, mix: AudioMix | null, t: number) {
  const active = activeClipsAt(project, t);
  const trackById: Record<string, Track> = {};
  project.tracks.forEach((tr) => {
    trackById[tr.id] = tr;
  });
  const activeAssetIds: string[] = [];

  active.forEach((clip) => {
    if (clip.type !== 'video' && clip.type !== 'audio' && clip.type !== 'overlay') return;
    if (!clip.assetId) return;
    const entry = getEntry(pool, clip.assetId);
    if (!entry || entry.type === 'image') return;
    if (activeAssetIds.indexOf(clip.assetId) === -1) activeAssetIds.push(clip.assetId);

    const el = entry.el;
    const track = trackById[clip.trackId];
    const muted = clip.audio.muted || (track ? track.muted : false);
    const vol = muted ? 0 : clamp(clip.audio.volume, 0, 2) * fadeEnvelope(clip, t);

    const gain = mix ? mix.gains[clip.assetId] : undefined;
    if (gain) {
      gain.gain.value = vol;
      el.muted = false; // routed through the graph; element output is captured by source node
    } else {
      // No mix graph — fall back to element volume (won't be captured, but keeps preview-like behavior harmless).
      el.volume = clamp(vol, 0, 1);
      el.muted = vol <= 0;
    }

    const rate = clip.speed?.rate ?? 1;
    if (Math.abs(el.playbackRate - rate) > 0.001) {
      try {
        el.playbackRate = rate;
      } catch {
        /* ignore */
      }
    }
    const target = clamp(clipSourceTime(clip, t), 0, Math.max(0, el.duration || clip.outPoint));
    if (Math.abs(el.currentTime - target) > 0.2) {
      try {
        el.currentTime = target;
      } catch {
        /* ignore */
      }
    }
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    }
  });

  // Silence + pause inactive media.
  pool.ids.forEach((id) => {
    const entry = pool.byId[id];
    if (!entry || entry.type === 'image') return;
    if (activeAssetIds.indexOf(id) !== -1) return;
    const gain = mix ? mix.gains[id] : undefined;
    if (gain) gain.gain.value = 0;
    if (!entry.el.paused) {
      try {
        entry.el.pause();
      } catch {
        /* ignore */
      }
    }
  });
}

/** Sync video frame position for clips whose audio path didn't already seek. */
function syncVideoFrames(project: Project, pool: PoolMap, t: number) {
  const active = activeClipsAt(project, t);
  active.forEach((clip) => {
    if (clip.type !== 'video' && clip.type !== 'overlay' && clip.type !== 'sticker') return;
    const entry = getEntry(pool, clip.assetId);
    if (!entry || entry.type !== 'video') return;
    const el = entry.el;
    if (el.readyState < 1) return;
    const rate = clip.speed?.rate ?? 1;
    if (Math.abs(el.playbackRate - rate) > 0.001) {
      try {
        el.playbackRate = rate;
      } catch {
        /* ignore */
      }
    }
    const target = clamp(clipSourceTime(clip, t), 0, Math.max(0, el.duration || clip.outPoint));
    if (Math.abs(el.currentTime - target) > 0.15) {
      try {
        el.currentTime = target;
      } catch {
        /* ignore */
      }
    }
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    }
  });
}

// ---------------------------------------------------------------------------
// GIF transcode (optional, lazy ffmpeg.wasm)
// ---------------------------------------------------------------------------
async function transcodeToGif(
  webm: Blob,
  width: number,
  fps: number,
  onProgress: (p: number, stage: string) => void,
): Promise<Blob> {
  onProgress(0.92, 'Converting to GIF…');
  // Lazy import so a missing/unloadable ffmpeg never breaks the build or the
  // primary video path.
  const ffmpegMod = await import('@ffmpeg/ffmpeg');
  const utilMod = await import('@ffmpeg/util');
  const ffmpeg = new ffmpegMod.FFmpeg();
  await ffmpeg.load();

  const inputName = 'in.webm';
  const paletteName = 'palette.png';
  const outputName = 'out.gif';
  const gifW = Math.min(width, 640); // keep GIFs reasonable

  await ffmpeg.writeFile(inputName, await utilMod.fetchFile(webm));

  // Two-pass palette for decent GIF quality.
  await ffmpeg.exec([
    '-i',
    inputName,
    '-vf',
    `fps=${fps},scale=${gifW}:-1:flags=lanczos,palettegen`,
    paletteName,
  ]);
  await ffmpeg.exec([
    '-i',
    inputName,
    '-i',
    paletteName,
    '-lavfi',
    `fps=${fps},scale=${gifW}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  // data is Uint8Array for binary files.
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const copy = new Uint8Array(bytes); // detach from ffmpeg memory
  return new Blob([copy], { type: 'image/gif' });
}

// ---------------------------------------------------------------------------
// Main export routine
// ---------------------------------------------------------------------------
export async function exportVideo(opts: ExportOptions): Promise<ExportResult> {
  const { project, assets, settings, onProgress, signal } = opts;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Recording is not supported in this browser.');
  }
  if (signal?.aborted) throw new Error('Export cancelled.');

  const { width, height } = outputDimensions(project, settings);
  const duration = projectDuration(project);
  if (duration <= 0) {
    throw new Error('Nothing to export — the timeline is empty.');
  }

  const fps = settings.fps || project.fps || 30;
  const safeName = (project.name || 'reelstudio').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'reelstudio';

  // -- set up the offscreen canvas --
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D rendering context.');

  onProgress(0, 'Loading media…');

  let pool: PoolMap | null = null;
  let mix: AudioMix | null = null;
  let recorder: MediaRecorder | null = null;
  let raf = 0;
  let audioNote = '';

  const cleanup = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    if (pool) destroyPool(pool);
    if (mix) {
      try {
        mix.ctx.close();
      } catch {
        /* ignore */
      }
    }
  };

  try {
    pool = await buildPool(project, assets);
    if (signal?.aborted) throw new Error('Export cancelled.');

    // -- audio mix (best effort) --
    const hasAudioSources = pool.ids.some((id) => {
      const e = pool!.byId[id];
      return e && e.type !== 'image';
    });
    if (hasAudioSources) {
      mix = buildAudioMix(pool);
      if (mix) {
        try {
          if (mix.ctx.state === 'suspended') await mix.ctx.resume();
        } catch {
          /* ignore */
        }
        const wired = Object.keys(mix.gains).length;
        if (wired === 0) {
          audioNote = ' (audio unavailable)';
          try {
            mix.ctx.close();
          } catch {
            /* ignore */
          }
          mix = null;
        }
      } else {
        audioNote = ' (audio unavailable)';
      }
    }

    // -- build the combined stream --
    const videoStream = canvas.captureStream(fps);
    const tracks: MediaStreamTrack[] = videoStream.getVideoTracks();
    if (mix) {
      mix.dest.stream.getAudioTracks().forEach((tr) => tracks.push(tr));
    }
    const stream = new MediaStream(tracks);

    const { mimeType, ext, isMp4 } = pickMimeType(settings.format);
    const recorderOpts: MediaRecorderOptions = {
      videoBitsPerSecond: bitrateForQuality(settings.quality),
    };
    if (mimeType) recorderOpts.mimeType = mimeType;

    try {
      recorder = new MediaRecorder(stream, recorderOpts);
    } catch {
      // Retry without an explicit mimeType if the chosen one was rejected.
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: bitrateForQuality(settings.quality) });
    }

    const chunks: BlobPart[] = [];
    const rec = recorder;
    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recordingDone = new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || 'video/webm';
        resolve(new Blob(chunks, { type }));
      };
      rec.onerror = () => reject(new Error('Recording failed.'));
    });

    const wmImageRef: { current: WmImageCache | null } = { current: null };
    const drawState: DrawState = { wmImageRef };

    // Prime the first frame before recording starts.
    syncVideoFrames(project, pool, 0);
    driveAudio(project, pool, mix, 0);
    drawFrame(ctx, 0, project, pool, settings, drawState);

    rec.start(100); // gather chunks periodically

    // -- real-time render loop driven by wall clock --
    const startWall = performance.now();
    let finished = false;

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) {
          finished = true;
          reject(new Error('Export cancelled.'));
          return;
        }
        const elapsed = (performance.now() - startWall) / 1000;
        const t = Math.min(elapsed, duration);

        syncVideoFrames(project, pool!, t);
        driveAudio(project, pool!, mix, t);
        drawFrame(ctx, t, project, pool!, settings, drawState);

        onProgress(clamp(t / duration, 0, 0.9), `Rendering…${audioNote}`);

        if (elapsed >= duration) {
          if (!finished) {
            finished = true;
            resolve();
          }
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    onProgress(0.9, 'Finalizing…');

    // Stop the recorder and collect the blob.
    if (rec.state !== 'inactive') rec.stop();
    let blob = await recordingDone;

    // Stop driving media.
    if (raf) cancelAnimationFrame(raf);
    raf = 0;

    let outExt = ext;
    if (settings.format === 'gif') {
      try {
        blob = await transcodeToGif(blob, width, Math.min(fps, 24), onProgress);
        outExt = 'gif';
      } catch {
        // GIF conversion failed — fall back to the recorded video container.
        onProgress(0.98, 'GIF conversion unavailable — saved as video.');
        outExt = isMp4 ? 'mp4' : 'webm';
      }
    }

    onProgress(1, 'Done');
    cleanup();
    return { blob, filename: `${safeName}.${outExt}` };
  } catch (err) {
    cleanup();
    if (err instanceof Error) {
      if (err.message === 'Export cancelled.') throw err;
      throw new Error(`Export failed: ${err.message}`);
    }
    throw new Error('Export failed due to an unknown error.');
  }
}
