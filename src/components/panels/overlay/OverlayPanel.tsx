'use client';

import { Layers, Film, ImageIcon, FlipHorizontal, FlipVertical } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import {
  PanelHeader,
  ScrollArea,
  Field,
  Slider,
  Toggle,
  EmptyState,
} from '@/components/ui/primitives';

const BLEND_MODES: { value: GlobalCompositeOperation; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'darken', label: 'Darken' },
  { value: 'difference', label: 'Difference' },
];

export default function OverlayPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const mediaAssets = useEditor((s) => s.mediaAssets);
  const addOverlayClip = useEditor((s) => s.addOverlayClip);
  const updateTransform = useEditor((s) => s.updateTransform);
  const updateClip = useEditor((s) => s.updateClip);

  const visualAssets = mediaAssets.filter((a) => a.type === 'video' || a.type === 'image');
  const isOverlay = clip?.type === 'overlay' || clip?.type === 'sticker';
  const t = isOverlay ? clip!.transform : null;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Overlay" subtitle="Picture-in-picture video & images" icon={<Layers size={18} />} />
      <ScrollArea>
        <Field label="Add overlay from media">
          {visualAssets.length === 0 ? (
            <EmptyState
              icon={<Layers size={26} />}
              title="No media to overlay"
              hint="Import videos or images in the Media panel to place them as overlays."
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visualAssets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addOverlayClip(a.id)}
                  title={a.name}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] transition hover:border-brand hover:shadow-glow-sm"
                >
                  {a.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnail}
                      alt={a.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      {a.type === 'video' ? <Film size={20} /> : <ImageIcon size={20} />}
                    </div>
                  )}
                  <span className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-white/70 backdrop-blur">
                    {a.type === 'video' ? <Film size={11} /> : <ImageIcon size={11} />}
                  </span>
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur">
                    {a.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Field>

        {isOverlay && t && (
          <div className="space-y-5 border-t border-stroke pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Transform</p>

            <Slider
              label="Scale"
              value={t.scale}
              min={0.1}
              max={2}
              step={0.01}
              display={`${t.scale.toFixed(2)}×`}
              onChange={(v) => updateTransform(clip!.id, { scale: v })}
            />
            <Slider
              label="Opacity"
              value={t.opacity}
              min={0}
              max={1}
              display={t.opacity.toFixed(2)}
              onChange={(v) => updateTransform(clip!.id, { opacity: v })}
            />
            <Slider
              label="Rotation"
              value={t.rotation}
              min={-180}
              max={180}
              step={1}
              display={`${Math.round(t.rotation)}°`}
              onChange={(v) => updateTransform(clip!.id, { rotation: v })}
            />
            <Slider
              label="Position X"
              value={t.x}
              min={-1}
              max={1}
              step={0.01}
              display={t.x.toFixed(2)}
              onChange={(v) => updateTransform(clip!.id, { x: v })}
            />
            <Slider
              label="Position Y"
              value={t.y}
              min={-1}
              max={1}
              step={0.01}
              display={t.y.toFixed(2)}
              onChange={(v) => updateTransform(clip!.id, { y: v })}
            />

            <div className="flex items-center gap-4">
              <Toggle
                checked={t.flipH}
                onChange={(v) => updateTransform(clip!.id, { flipH: v })}
                label="Flip H"
              />
              <FlipHorizontal size={14} className="-ml-2 text-white/30" />
              <Toggle
                checked={t.flipV}
                onChange={(v) => updateTransform(clip!.id, { flipV: v })}
                label="Flip V"
              />
              <FlipVertical size={14} className="-ml-2 text-white/30" />
            </div>

            <Field label="Blend mode">
              <select
                value={clip!.blendMode ?? 'source-over'}
                onChange={(e) => updateClip(clip!.id, { blendMode: e.target.value as GlobalCompositeOperation })}
                className="w-full rounded-md border border-stroke bg-panel-3 px-2.5 py-2 text-xs text-white/80 outline-none focus:border-brand"
              >
                {BLEND_MODES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
