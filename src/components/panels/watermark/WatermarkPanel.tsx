'use client';

import { useRef } from 'react';
import { Stamp, Upload, X } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { FONT_FAMILIES } from '@/lib/constants';
import type { Watermark, WatermarkPosition } from '@/types/editor';
import {
  PanelHeader,
  ScrollArea,
  Field,
  Slider,
  Segmented,
  ColorInput,
  Toggle,
  TextInput,
  Button,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const POSITIONS: WatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

// Flexbox alignment so each cell's dot sits where the watermark would land.
const ALIGN_MAP: Record<WatermarkPosition, string> = {
  'top-left': 'items-start justify-start',
  'top-center': 'items-start justify-center',
  'top-right': 'items-start justify-end',
  'center-left': 'items-center justify-start',
  center: 'items-center justify-center',
  'center-right': 'items-center justify-end',
  'bottom-left': 'items-end justify-start',
  'bottom-center': 'items-end justify-center',
  'bottom-right': 'items-end justify-end',
};

export default function WatermarkPanel() {
  const watermark = useEditor((s) => s.project.watermark);
  const updateWatermark = useEditor((s) => s.updateWatermark);
  const toggleWatermark = useEditor((s) => s.toggleWatermark);
  const fileRef = useRef<HTMLInputElement>(null);

  const wm: Watermark = watermark;

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    updateWatermark({ imageUrl, imageName: file.name });
    e.target.value = '';
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Watermark" subtitle="Brand overlay over the whole video" icon={<Stamp size={18} />} />
      <ScrollArea>
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border px-3 py-3 transition',
            wm.enabled
              ? 'border-brand/40 bg-brand-gradient-soft shadow-glow-sm'
              : 'border-white/[0.06] bg-white/[0.03]',
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition',
                wm.enabled ? 'bg-brand text-white' : 'bg-white/[0.05] text-white/40',
              )}
            >
              <Stamp size={14} />
            </span>
            <span className="text-xs font-semibold text-white/85">Enable watermark</span>
          </div>
          <Toggle checked={wm.enabled} onChange={() => toggleWatermark()} />
        </div>

        <Field label="Mode">
          <Segmented<'text' | 'image'>
            value={wm.mode}
            onChange={(v) => updateWatermark({ mode: v })}
            options={[
              { value: 'text', label: 'Text' },
              { value: 'image', label: 'Image' },
            ]}
          />
        </Field>

        {wm.mode === 'text' ? (
          <div className="space-y-5">
            <Field label="Text">
              <TextInput value={wm.text} onChange={(v) => updateWatermark({ text: v })} placeholder="@yourbrand" />
            </Field>
            <Field label="Font">
              <select
                value={wm.fontFamily}
                onChange={(e) => updateWatermark({ fontFamily: e.target.value })}
                className="w-full rounded-md border border-stroke bg-panel-3 px-2.5 py-2 text-xs text-white/80 outline-none focus:border-brand"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Slider
              label="Font size"
              value={wm.fontSize}
              min={12}
              max={200}
              step={1}
              display={`${Math.round(wm.fontSize)}px`}
              onChange={(v) => updateWatermark({ fontSize: v })}
            />
            <Field label="Color">
              <ColorInput value={wm.color} onChange={(v) => updateWatermark({ color: v })} />
            </Field>
          </div>
        ) : (
          <Field label="Image">
            {wm.imageUrl ? (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border border-stroke bg-panel-3 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wm.imageUrl} alt={wm.imageName ?? 'watermark'} className="mx-auto max-h-32 object-contain" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-white/40">{wm.imageName ?? 'image'}</span>
                  <Button
                    variant="danger"
                    onClick={() => updateWatermark({ imageUrl: null, imageName: undefined })}
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <X size={13} /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 py-3"
                >
                  <Upload size={15} /> Upload image
                </Button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
              </>
            )}
          </Field>
        )}

        {/* Shared controls */}
        <div className="space-y-5 border-t border-stroke pt-5">
          <Field label="Position">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.06] bg-black/30 p-1.5">
              {POSITIONS.map((p) => {
                const active = wm.position === p;
                const align = ALIGN_MAP[p];
                return (
                  <button
                    key={p}
                    onClick={() => updateWatermark({ position: p })}
                    title={p.replace('-', ' ')}
                    className={cn(
                      'flex aspect-[3/2] p-1 transition',
                      align,
                      active
                        ? 'rounded-md bg-brand-gradient-soft ring-1 ring-brand'
                        : 'rounded-md hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full transition',
                        active ? 'bg-brand-2 shadow-glow-sm' : 'bg-white/25',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </Field>

          <Slider
            label="Opacity"
            value={wm.opacity}
            min={0}
            max={1}
            display={wm.opacity.toFixed(2)}
            onChange={(v) => updateWatermark({ opacity: v })}
          />
          <Slider
            label="Scale"
            value={wm.scale}
            min={0.05}
            max={1}
            step={0.01}
            display={`${Math.round(wm.scale * 100)}%`}
            onChange={(v) => updateWatermark({ scale: v })}
          />
          <Slider
            label="Rotation"
            value={wm.rotation}
            min={-180}
            max={180}
            step={1}
            display={`${Math.round(wm.rotation)}°`}
            onChange={(v) => updateWatermark({ rotation: v })}
          />
          <Slider
            label="Margin"
            value={wm.margin}
            min={0}
            max={200}
            step={1}
            display={`${Math.round(wm.margin)}px`}
            onChange={(v) => updateWatermark({ margin: v })}
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">Tiled (repeat)</span>
            <Toggle checked={wm.tiled} onChange={(v) => updateWatermark({ tiled: v })} />
          </div>
          {wm.tiled && (
            <Slider
              label="Tile gap"
              value={wm.tileGap}
              min={50}
              max={600}
              step={1}
              display={`${Math.round(wm.tileGap)}px`}
              onChange={(v) => updateWatermark({ tileGap: v })}
            />
          )}

          <p className="rounded-lg border border-stroke bg-panel-2/40 px-3 py-2.5 text-[11px] leading-relaxed text-white/40">
            Watermark renders live in the preview and is burned into the export when enabled.
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
