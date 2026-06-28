'use client';

import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  Upload,
  Plus,
  Trash2,
  Film,
  ImageIcon,
  Music,
  Layers,
  Loader2,
  Link2,
  AlertCircle,
} from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import type { MediaAsset } from '@/types/editor';
import { cn, formatTime, formatFileSize } from '@/lib/utils';
import {
  PanelHeader,
  Button,
  EmptyState,
  ScrollArea,
} from '@/components/ui/primitives';

// ---------------------------------------------------------------------------
// Metadata probing helpers (best-effort, Promise-based)
// ---------------------------------------------------------------------------

function probeVideo(
  url: string,
): Promise<{ duration: number; width: number; height: number; thumbnail?: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    let settled = false;
    const finish = (
      result: { duration: number; width: number; height: number; thumbnail?: string },
    ) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const makeThumbnail = (): string | undefined => {
      try {
        const canvas = document.createElement('canvas');
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 180;
        const scale = Math.min(1, 320 / Math.max(1, w));
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.7);
      } catch {
        return undefined;
      }
    };

    video.addEventListener('loadedmetadata', () => {
      const duration = isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      // Seek a little in to grab a representative frame.
      const seekTo = Math.min(0.1, duration > 0 ? duration / 2 : 0);
      const onSeeked = () => {
        const thumbnail = makeThumbnail();
        finish({ duration, width, height, thumbnail });
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      try {
        video.currentTime = seekTo;
      } catch {
        finish({ duration, width, height, thumbnail: makeThumbnail() });
      }
    });

    video.addEventListener('error', () => finish({ duration: 0, width: 0, height: 0 }));

    // Safety timeout so a stuck probe never blocks import.
    setTimeout(() => finish({ duration: 0, width: 0, height: 0 }), 8000);
  });
}

function probeImage(
  url: string,
): Promise<{ duration: number; width: number; height: number; thumbnail?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        duration: 0,
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
        thumbnail: url,
      });
    img.onerror = () => resolve({ duration: 0, width: 0, height: 0, thumbnail: url });
    img.src = url;
  });
}

function probeAudio(
  url: string,
): Promise<{ duration: number; width: number; height: number; thumbnail?: string }> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    let settled = false;
    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      resolve({ duration, width: 0, height: 0 });
    };
    audio.addEventListener('loadedmetadata', () =>
      finish(isFinite(audio.duration) ? audio.duration : 0),
    );
    audio.addEventListener('error', () => finish(0));
    setTimeout(() => finish(0), 8000);
  });
}

function assetTypeForFile(file: File): MediaAsset['type'] | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

/** Best-effort media type from a URL's file extension. */
function assetTypeFromUrl(url: string): MediaAsset['type'] | null {
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(clean)) return 'video';
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac)$/.test(clean)) return 'audio';
  if (/\.(png|jpe?g|gif|webp|bmp|avif|svg)$/.test(clean)) return 'image';
  return null;
}

const YT_RE = /(youtube\.com|youtu\.be)/i;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MediaPanel() {
  const mediaAssets = useEditor((s) => s.mediaAssets);
  const addMediaAsset = useEditor((s) => s.addMediaAsset);
  const removeMediaAsset = useEditor((s) => s.removeMediaAsset);
  const addClipFromAsset = useEditor((s) => s.addClipFromAsset);
  const addOverlayClip = useEditor((s) => s.addOverlayClip);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [urlValue, setUrlValue] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const importFromUrl = useCallback(
    async (raw: string) => {
      const url = raw.trim();
      if (!url) return;
      setUrlError(null);

      if (YT_RE.test(url)) {
        setUrlError(
          'Direct YouTube import isn’t possible from the browser (CORS + YouTube’s Terms). Paste a direct file link (.mp4 / .mp3 / .wav), or download the audio and use Import.',
        );
        return;
      }

      setUrlLoading(true);
      try {
        let objUrl = url;
        let fileSize = 0;
        let type: MediaAsset['type'] | null = null;

        // Prefer fetching to a blob (keeps the canvas untainted for export).
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          fileSize = blob.size;
          if (blob.type.startsWith('video/')) type = 'video';
          else if (blob.type.startsWith('audio/')) type = 'audio';
          else if (blob.type.startsWith('image/')) type = 'image';
          else type = assetTypeFromUrl(url);
          if (!type) throw new Error('unknown type');
          objUrl = URL.createObjectURL(blob);
        } catch {
          // CORS / network blocked the fetch — fall back to the raw URL, which
          // still plays in <audio>/<video>/<img>. (Video export of cross-origin
          // sources without CORS may be limited, but audio works fine.)
          type = assetTypeFromUrl(url);
          objUrl = url;
        }

        if (!type) {
          setUrlError('Couldn’t determine the media type. Use a direct .mp4 / .mp3 / .wav / .png link.');
          setUrlLoading(false);
          return;
        }

        const meta =
          type === 'video'
            ? await probeVideo(objUrl)
            : type === 'image'
              ? await probeImage(objUrl)
              : await probeAudio(objUrl);

        const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Imported media');
        addMediaAsset({
          id: nanoid(8),
          type,
          name,
          url: objUrl,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          thumbnail: meta.thumbnail,
          fileSize,
          createdAt: Date.now(),
        });
        setUrlValue('');
      } catch {
        setUrlError('Import failed — the link may block cross-origin access (CORS) or be unreachable.');
      } finally {
        setUrlLoading(false);
      }
    },
    [addMediaAsset],
  );

  const importFile = useCallback(
    async (file: File) => {
      const type = assetTypeForFile(file);
      if (!type) return;
      const url = URL.createObjectURL(file);
      let meta: { duration: number; width: number; height: number; thumbnail?: string };
      try {
        if (type === 'video') meta = await probeVideo(url);
        else if (type === 'image') meta = await probeImage(url);
        else meta = await probeAudio(url);
      } catch {
        meta = { duration: 0, width: 0, height: 0 };
      }
      const asset: MediaAsset = {
        id: nanoid(8),
        type,
        name: file.name,
        url,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        thumbnail: meta.thumbnail,
        fileSize: file.size,
        createdAt: Date.now(),
      };
      addMediaAsset(asset);
    },
    [addMediaAsset],
  );

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => assetTypeForFile(f) !== null);
      if (!list.length) return;
      setLoadingCount((c) => c + list.length);
      await Promise.all(
        list.map(async (f) => {
          try {
            await importFile(f);
          } finally {
            setLoadingCount((c) => Math.max(0, c - 1));
          }
        }),
      );
    },
    [importFile],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void importFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
  };

  const handleRemove = (asset: MediaAsset) => {
    try {
      if (asset.url.startsWith('blob:')) URL.revokeObjectURL(asset.url);
    } catch {
      /* noop */
    }
    removeMediaAsset(asset.id);
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Media library"
        subtitle="Import video, images & audio"
        icon={<Film size={16} />}
      />

      <ScrollArea>
        {/* Import dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition',
            isDragging
              ? 'border-brand bg-brand-gradient-soft shadow-glow-sm'
              : 'border-white/[0.12] bg-white/[0.03] hover:border-brand/60 hover:bg-white/[0.05]',
          )}
        >
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl transition',
              isDragging ? 'bg-brand text-white shadow-brand' : 'bg-brand-gradient-soft text-brand-2',
            )}
          >
            <Upload size={22} />
          </div>
          <p className="text-xs font-medium text-white/70">Drag &amp; drop files here</p>
          <p className="text-[10px] text-white/30">Video, image or audio</p>
          {/* Wrapper stops the click from bubbling to the dropzone, which would
              otherwise open the file picker a second time. */}
          <span onClick={(e) => e.stopPropagation()} className="mt-1 inline-flex">
            <Button onClick={(): void => inputRef.current?.click()}>
              Import media
            </Button>
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            onChange={onInputChange}
            className="hidden"
          />
        </div>

        {loadingCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
            <Loader2 size={14} className="animate-spin text-brand-2" />
            Importing {loadingCount} file{loadingCount > 1 ? 's' : ''}…
          </div>
        )}

        {/* Import from URL */}
        <div className="space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
            <Link2 size={13} className="text-brand-2" /> Import from link
          </div>
          <div className="flex gap-2">
            <input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void importFromUrl(urlValue);
              }}
              placeholder="Paste a media URL or YouTube link…"
              className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-xs text-white/80 outline-none transition placeholder:text-white/25 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
            <button
              onClick={() => void importFromUrl(urlValue)}
              disabled={urlLoading || !urlValue.trim()}
              className="flex shrink-0 items-center justify-center gap-1 rounded-lg bg-brand-gradient px-3 py-2 text-[11px] font-semibold text-white shadow-brand transition hover:brightness-110 disabled:opacity-40"
            >
              {urlLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add
            </button>
          </div>
          {urlError ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10.5px] leading-relaxed text-amber-300/90">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{urlError}</span>
            </div>
          ) : (
            <p className="text-[10px] leading-relaxed text-white/30">
              Works with direct file links (.mp4, .mp3, .wav, images). YouTube can’t be downloaded in-browser.
            </p>
          )}
        </div>

        {/* Library grid */}
        {mediaAssets.length === 0 && loadingCount === 0 ? (
          <EmptyState
            icon={<Film size={28} />}
            title="No media yet"
            hint="Import video, images or audio to start building your reel."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mediaAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onAdd={() => addClipFromAsset(asset.id)}
                onOverlay={
                  asset.type === 'audio' ? undefined : () => addOverlayClip(asset.id)
                }
                onRemove={() => handleRemove(asset)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset card
// ---------------------------------------------------------------------------

function TypeIcon({ type, size = 16 }: { type: MediaAsset['type']; size?: number }) {
  if (type === 'video') return <Film size={size} />;
  if (type === 'image') return <ImageIcon size={size} />;
  return <Music size={size} />;
}

function AssetCard({
  asset,
  onAdd,
  onOverlay,
  onRemove,
}: {
  asset: MediaAsset;
  onAdd: () => void;
  onOverlay?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] transition hover:border-white/[0.14] hover:shadow-panel">
      {/* Thumbnail / preview */}
      <button
        onClick={onAdd}
        title="Add to timeline"
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black/40"
      >
        {asset.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnail}
            alt={asset.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="text-white/25">
            <TypeIcon type={asset.type} size={28} />
          </div>
        )}

        {/* hover overlay quick-add */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 backdrop-blur-[1px] transition group-hover:opacity-100">
          <span className="flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1.5 text-[10px] font-bold text-white shadow-brand">
            <Plus size={12} /> Add
          </span>
        </span>

        {/* badge */}
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/80 backdrop-blur">
          <TypeIcon type={asset.type} size={10} />
          {asset.type !== 'image' && asset.duration > 0 && (
            <span className="tabular-nums">{formatTime(asset.duration, false)}</span>
          )}
        </span>
      </button>

      {/* meta + actions */}
      <div className="space-y-1.5 p-2">
        <p className="truncate text-[11px] font-medium text-white/80" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] text-white/30">{formatFileSize(asset.fileSize ?? 0)}</p>

        <div className="flex items-center gap-1 pt-0.5">
          <button
            onClick={onAdd}
            title="Add to timeline"
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-gradient px-2 py-1 text-[10px] font-semibold text-white shadow-brand transition hover:opacity-90"
          >
            <Plus size={12} /> Add
          </button>
          {onOverlay && (
            <button
              onClick={onOverlay}
              title="Add as overlay"
              className="flex items-center justify-center rounded-md bg-white/[0.05] px-2 py-1 text-white/60 transition hover:bg-white/[0.1] hover:text-white"
            >
              <Layers size={12} />
            </button>
          )}
          <button
            onClick={onRemove}
            title="Remove from library"
            className="flex items-center justify-center rounded-md bg-white/[0.05] px-2 py-1 text-white/50 transition hover:bg-red-500/20 hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
