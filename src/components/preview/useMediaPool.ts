'use client';

// =============================================================================
// useMediaPool — keeps a hidden HTMLMediaElement / HTMLImageElement per asset.
// Video assets get a muted, preloaded, inline <video>; image assets an Image;
// audio assets an <audio>. Elements are created/cleaned up as mediaAssets change
// and exposed via a stable ref map keyed by assetId.
// =============================================================================

import { useEffect, useRef } from 'react';
import { useEditor } from '@/store/editorStore';
import type { MediaAsset } from '@/types/editor';

export type PoolEntry =
  | { type: 'video'; el: HTMLVideoElement; asset: MediaAsset }
  | { type: 'image'; el: HTMLImageElement; asset: MediaAsset }
  | { type: 'audio'; el: HTMLAudioElement; asset: MediaAsset };

export type MediaPool = Map<string, PoolEntry>;

/**
 * Returns a ref to a Map<assetId, PoolEntry>. The map identity is stable across
 * renders; its contents are reconciled in an effect whenever mediaAssets change.
 */
export function useMediaPool() {
  const mediaAssets = useEditor((s) => s.mediaAssets);
  const poolRef = useRef<MediaPool>(new Map());

  useEffect(() => {
    const pool = poolRef.current;
    const seen = new Set<string>();

    for (const asset of mediaAssets) {
      seen.add(asset.id);
      const existing = pool.get(asset.id);
      // Recreate if the underlying url changed (re-import) or type mismatch.
      if (existing && existing.asset.url === asset.url && existing.type === asset.type) {
        existing.asset = asset;
        continue;
      }
      if (existing) destroyEntry(existing);

      if (asset.type === 'video') {
        const el = document.createElement('video');
        el.muted = true;
        el.defaultMuted = true;
        el.preload = 'auto';
        el.playsInline = true;
        el.crossOrigin = 'anonymous';
        el.loop = false;
        el.src = asset.url;
        // Keep it off-screen but present so it decodes frames.
        el.style.position = 'absolute';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.left = '-9999px';
        el.load();
        pool.set(asset.id, { type: 'video', el, asset });
      } else if (asset.type === 'audio') {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        el.loop = false;
        el.src = asset.url;
        pool.set(asset.id, { type: 'audio', el, asset });
      } else {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.decoding = 'async';
        el.src = asset.url;
        pool.set(asset.id, { type: 'image', el, asset });
      }
    }

    // Remove entries whose asset no longer exists.
    const stale: string[] = [];
    pool.forEach((entry, id) => {
      if (!seen.has(id)) {
        destroyEntry(entry);
        stale.push(id);
      }
    });
    stale.forEach((id) => pool.delete(id));
  }, [mediaAssets]);

  // Full cleanup on unmount.
  useEffect(() => {
    const pool = poolRef.current;
    return () => {
      pool.forEach((entry) => destroyEntry(entry));
      pool.clear();
    };
  }, []);

  return poolRef;
}

function destroyEntry(entry: PoolEntry) {
  try {
    if (entry.type === 'video' || entry.type === 'audio') {
      entry.el.pause();
      entry.el.removeAttribute('src');
      entry.el.load();
      entry.el.remove?.();
    } else {
      entry.el.src = '';
    }
  } catch {
    /* ignore */
  }
}
