import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Seconds -> mm:ss.ms (e.g. 01:23.4) */
export function formatTime(seconds: number, withMs = true): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return withMs ? `${base}.${ms}` : base;
}

/** Seconds -> hh:mm:ss:ff for timecode-style display */
export function formatTimecode(seconds: number, fps = 30): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total % 1) * fps);
  return [h, m, s, f].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0 || !isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function easeValue(t: number, easing: string): number {
  switch (easing) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:
      return t;
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
