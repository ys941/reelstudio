'use client';

// =============================================================================
// CanvasPlayer — the canvas element + the rAF render loop. Draws every active
// clip each frame (video/image base, overlay/sticker PIP, text on top), then the
// watermark. Advances time by wall-clock delta while playing and drives audio.
// =============================================================================

import { useEffect, useRef } from 'react';
import { useEditor } from '@/store/editorStore';
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
import type { Clip, TextStyle, Track, Watermark } from '@/types/editor';
import type { MediaPool, PoolEntry } from './useMediaPool';

interface Props {
  poolRef: React.MutableRefObject<MediaPool>;
  /** Reports the displayed (CSS) rect of the canvas so overlays can align. */
  onCanvasRect?: (rect: { width: number; height: number; left: number; top: number }) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function CanvasPlayer({ poolRef, onCanvasRect, containerRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cache for a watermark image so we don't reload it every frame.
  const wmImageRef = useRef<{ url: string; img: HTMLImageElement; loaded: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastWall = performance.now();

    // -- size the canvas backing store to the project aspect ratio --
    const applyCanvasSize = () => {
      const { project } = useEditor.getState();
      const { width, height } = project.aspectRatio;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    // -- fit the canvas inside the container (letterbox), centered via CSS --
    const layout = () => {
      const { project } = useEditor.getState();
      const aw = project.aspectRatio.width;
      const ah = project.aspectRatio.height;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (!cw || !ch) return;
      const scale = Math.min(cw / aw, ch / ah);
      const dispW = Math.max(1, Math.round(aw * scale));
      const dispH = Math.max(1, Math.round(ah * scale));
      canvas.style.width = `${dispW}px`;
      canvas.style.height = `${dispH}px`;
      const left = (cw - dispW) / 2;
      const top = (ch - dispH) / 2;
      onCanvasRect?.({ width: dispW, height: dispH, left, top });
    };

    const ro = new ResizeObserver(() => {
      applyCanvasSize();
      layout();
    });
    ro.observe(container);
    applyCanvasSize();
    layout();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const store = useEditor.getState();
      const { project } = store;
      const pool = poolRef.current;

      applyCanvasSize();
      layout();

      const now = performance.now();
      const dt = Math.min(0.25, Math.max(0, (now - lastWall) / 1000));
      lastWall = now;

      // -- advance playhead while playing --
      let t = store.currentTime;
      if (store.isPlaying) {
        const duration = store.getDuration();
        t = store.currentTime + dt;
        if (duration > 0 && t >= duration) {
          t = duration;
          store.seek(t);
          store.pause();
        } else {
          store.seek(t);
        }
      }

      const W = canvas.width;
      const H = canvas.height;

      // -- clear + background --
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = project.backgroundColor || '#000000';
      ctx.fillRect(0, 0, W, H);

      const active = store.getActiveClipsAt(t);

      // Render tracks bottom-to-top: iterate project.tracks in REVERSE so the
      // last array item draws first (bottom), the first item draws last (top).
      for (let i = project.tracks.length - 1; i >= 0; i--) {
        const track = project.tracks[i];
        if (track.hidden) continue;
        const clips = active.filter((c) => c.trackId === track.id);
        // Within a track, draw base media first, then overlay/sticker, then text.
        const ordered = sortForDraw(clips);
        for (const clip of ordered) {
          drawClip(ctx, clip, track, t, pool, W, H);
        }
      }

      // -- watermark last on top --
      if (project.watermark.enabled) {
        drawWatermark(ctx, project.watermark, W, H, wmImageRef);
      }

      // -- audio sync --
      syncAudio(active, pool, t, store.isPlaying, project.tracks);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      // pause every pooled media element on unmount
      const pool = poolRef.current;
      pool.forEach((entry) => {
        if (entry.type !== 'image') {
          try {
            entry.el.pause();
          } catch {
            /* ignore */
          }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/[0.08]"
      style={{ background: '#000' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Draw ordering
// ---------------------------------------------------------------------------
function drawRank(c: Clip): number {
  if (c.type === 'text') return 2;
  if (c.type === 'overlay' || c.type === 'sticker') return 1;
  return 0; // video / image base
}
function sortForDraw(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => drawRank(a) - drawRank(b));
}

// ---------------------------------------------------------------------------
// Per-clip drawing
// ---------------------------------------------------------------------------
function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  track: Track,
  t: number,
  pool: MediaPool,
  W: number,
  H: number,
) {
  if (clip.type === 'text' && clip.text) {
    drawText(ctx, clip, clip.text, t, W, H);
    return;
  }

  const entry = clip.assetId ? pool.get(clip.assetId) : undefined;
  if (!entry) return;

  if (clip.type === 'video' || clip.type === 'image') {
    drawBaseMedia(ctx, clip, entry, t, W, H);
  } else if (clip.type === 'overlay' || clip.type === 'sticker') {
    drawPip(ctx, clip, entry, t, W, H);
  }
}

// Reusable offscreen canvas for chroma keying (created lazily, reused each frame).
let chromaCanvas: HTMLCanvasElement | null = null;

/** Return a chroma-keyed drawable (transparent green screen), or the source unchanged. */
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
    return src; // tainted canvas / not ready
  }
  return c;
}

/** Resolve a drawable source + its natural size from a pool entry. */
function getDrawable(entry: PoolEntry): { src: CanvasImageSource; w: number; h: number } | null {
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
  return null; // audio has nothing to draw
}

/** Keep a video element synced to the timeline (seek when paused / drifting). */
function syncVideoTime(entry: PoolEntry, clip: Clip, t: number, isPlaying: boolean) {
  if (entry.type !== 'video') return;
  const v = entry.el;
  if (v.readyState < 1) return;
  const target = clamp(clipSourceTime(clip, t), 0, Math.max(0, v.duration || clip.outPoint));
  const rate = clip.speed?.rate ?? 1;
  if (isPlaying) {
    if (Math.abs(v.playbackRate - rate) > 0.001) {
      try {
        v.playbackRate = rate;
      } catch {
        /* some rates unsupported */
      }
    }
    if (Math.abs(v.currentTime - target) > 0.1) v.currentTime = target;
  } else {
    if (Math.abs(v.currentTime - target) > 0.03) v.currentTime = target;
  }
}

function drawBaseMedia(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  entry: PoolEntry,
  t: number,
  W: number,
  H: number,
) {
  const isPlaying = useEditor.getState().isPlaying;
  syncVideoTime(entry, clip, t, isPlaying);

  const d = getDrawable(entry);
  if (!d) return;

  const tf = resolveTransform(clip, t);
  // crop selects a source sub-rect and cover-fits it into the frame
  const c = cropRects(W, H, d.w, d.h, clip.transform.crop, 'cover');

  ctx.save();
  ctx.filter = buildFilterString(clip.adjustments) || 'none';
  ctx.globalAlpha = clamp(tf.opacity, 0, 1) * transitionOpacity(clip, t);

  // center + normalized offset
  ctx.translate(W / 2 + (tf.x * W) / 2, H / 2 + (tf.y * H) / 2);
  ctx.rotate((tf.rotation * Math.PI) / 180);
  const sx = (tf.flipH ? -1 : 1) * tf.scale;
  const sy = (tf.flipV ? -1 : 1) * tf.scale;
  ctx.scale(sx, sy);

  // dest rect is in frame space (origin top-left); recenter around 0,0
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
  entry: PoolEntry,
  t: number,
  W: number,
  H: number,
) {
  const isPlaying = useEditor.getState().isPlaying;
  syncVideoTime(entry, clip, t, isPlaying);

  const d = getDrawable(entry);
  if (!d) return;

  const tf = resolveTransform(clip, t);
  // crop the source first, then contain-fit the cropped region and scale.
  const cr = clip.transform.crop;
  const csx = (cr?.left ?? 0) * d.w;
  const csy = (cr?.top ?? 0) * d.h;
  const csw = Math.max(1, (1 - (cr?.left ?? 0) - (cr?.right ?? 0)) * d.w);
  const csh = Math.max(1, (1 - (cr?.top ?? 0) - (cr?.bottom ?? 0)) * d.h);
  // PIP: base size = contain within frame, then scaled by transform.scale.
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

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
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
  // typewriter reveal counts characters across the whole block
  const lines = anim.revealChars == null ? fullLines : revealText(fullLines, anim.revealChars);

  ctx.save();
  ctx.globalAlpha = clamp(tf.opacity, 0, 1) * anim.alpha * transitionOpacity(clip, t);

  ctx.translate(W / 2 + (tf.x * W) / 2, H / 2 + (tf.y * H) / 2 + anim.offsetY);
  ctx.rotate((tf.rotation * Math.PI) / 180);
  ctx.scale(tf.scale * anim.scale, tf.scale * anim.scale);

  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = style.align as CanvasTextAlign;
  // letterSpacing is supported in modern canvas; guard for TS + older engines.
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

  // background pill
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

  // shadow
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
  // measureText already accounts for letterSpacing in engines that support it.
  let width = m.width;
  if (!('letterSpacing' in ctx) && letterSpacing) width += letterSpacing * Math.max(0, line.length - 1);
  return { width };
}

function revealText(lines: string[], chars: number): string[] {
  let remaining = Math.max(0, Math.floor(chars));
  const out: string[] = [];
  for (const line of lines) {
    if (remaining <= 0) {
      out.push('');
      continue;
    }
    if (remaining >= line.length) {
      out.push(line);
      remaining -= line.length + 1; // +1 for the newline
    } else {
      out.push(line.slice(0, remaining));
      remaining = 0;
    }
  }
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

  // ---- IN ----
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

  // ---- OUT ---- (only if not already animating in)
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

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  wm: Watermark,
  W: number,
  H: number,
  imageRef: React.MutableRefObject<{ url: string; img: HTMLImageElement; loaded: boolean } | null>,
) {
  const scaleRef = H / 1080;
  ctx.save();
  ctx.globalAlpha = clamp(wm.opacity, 0, 1);

  if (wm.mode === 'image' && wm.imageUrl) {
    // (re)load image into cache if url changed
    if (!imageRef.current || imageRef.current.url !== wm.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const ref = { url: wm.imageUrl, img, loaded: false };
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

/** Place watermark content once or tiled, applying rotation about content center. */
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
    // Guard: a zero/negative step (negative gap or near-zero content) would make
    // these loops never advance and freeze the render loop.
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
// Audio
// ---------------------------------------------------------------------------
function fadeEnvelope(clip: Clip, t: number): number {
  const local = clipLocalTime(clip, t);
  const { fadeIn, fadeOut } = clip.audio;
  const fromEnd = clip.duration - local;
  let g = 1;
  if (fadeIn > 0 && local < fadeIn) g = Math.min(g, local / fadeIn);
  if (fadeOut > 0 && fromEnd < fadeOut) g = Math.min(g, Math.max(0, fromEnd) / fadeOut);
  return clamp(g, 0, 1);
}

function syncAudio(active: Clip[], pool: MediaPool, t: number, isPlaying: boolean, tracks: Track[]) {
  const trackById = new Map(tracks.map((tr) => [tr.id, tr]));
  const activeAssetIds = new Set<string>();

  for (const clip of active) {
    if (clip.type !== 'video' && clip.type !== 'audio' && clip.type !== 'overlay') continue;
    if (!clip.assetId) continue;
    const entry = pool.get(clip.assetId);
    if (!entry || entry.type === 'image') continue;
    activeAssetIds.add(clip.assetId);
    const el = entry.el;
    const track = trackById.get(clip.trackId);

    const muted = clip.audio.muted || track?.muted || false;
    const vol = muted ? 0 : clamp(clip.audio.volume, 0, 1) * fadeEnvelope(clip, t);
    el.volume = vol;
    el.muted = vol <= 0;

    if (isPlaying) {
      const rate = clip.speed?.rate ?? 1;
      if (Math.abs(el.playbackRate - rate) > 0.001) {
        try {
          el.playbackRate = rate;
        } catch {
          /* ignore */
        }
      }
      const target = clamp(clipSourceTime(clip, t), 0, Math.max(0, el.duration || clip.outPoint));
      if (Math.abs(el.currentTime - target) > 0.25) el.currentTime = target;
      if (el.paused) {
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } else if (!el.paused) {
      el.pause();
    }
  }

  // pause every audio/video element that isn't currently active
  pool.forEach((entry, id) => {
    if (entry.type === 'image') return;
    if (activeAssetIds.has(id)) return;
    if (!entry.el.paused) entry.el.pause();
  });
}
