'use client';

import { useEditor } from '@/store/editorStore';
import { Crop, RotateCcw, FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, EmptyState, Field, PanelHeader, ScrollArea, Slider } from '@/components/ui/primitives';
import type { Transform } from '@/types/editor';

type CropEdges = NonNullable<Transform['crop']>;
const ZERO: CropEdges = { left: 0, top: 0, right: 0, bottom: 0 };

const ASPECTS: { label: string; ratio: number | null }[] = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '3:4', ratio: 3 / 4 },
];

export default function CropPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const assets = useEditor((s) => s.mediaAssets);
  const updateTransform = useEditor((s) => s.updateTransform);
  const commit = useEditor((s) => s.commit);

  const croppable = !!clip && (clip.type === 'video' || clip.type === 'image' || clip.type === 'overlay' || clip.type === 'sticker');

  if (!croppable) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader title="Crop" subtitle="Trim the edges of a clip" icon={<Crop size={16} />} />
        <EmptyState
          icon={<Crop size={28} />}
          title="Select a clip to crop"
          hint="Pick a video, image or overlay clip on the timeline, then crop its edges or apply an aspect ratio."
        />
      </div>
    );
  }

  const crop: CropEdges = { ...ZERO, ...(clip!.transform.crop || {}) };
  const asset = assets.find((a) => a.id === clip!.assetId);

  const setCrop = (patch: Partial<CropEdges>) =>
    updateTransform(clip!.id, { crop: { ...crop, ...patch } });

  const applyAspect = (ratio: number | null) => {
    commit();
    if (ratio === null) {
      updateTransform(clip!.id, { crop: { ...ZERO } });
      return;
    }
    if (!asset || !asset.width || !asset.height) {
      updateTransform(clip!.id, { crop: { ...ZERO } });
      return;
    }
    const sourceAR = asset.width / asset.height;
    const next: CropEdges = { ...ZERO };
    if (sourceAR > ratio) {
      // too wide -> crop left/right
      const total = 1 - ratio / sourceAR;
      next.left = total / 2;
      next.right = total / 2;
    } else {
      // too tall -> crop top/bottom
      const total = 1 - sourceAR / ratio;
      next.top = total / 2;
      next.bottom = total / 2;
    }
    updateTransform(clip!.id, { crop: next });
  };

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const isActive = (ratio: number | null) => {
    if (ratio === null) return crop.left + crop.right + crop.top + crop.bottom < 0.001;
    return false; // presets are one-shot; we don't track which was applied
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Crop" subtitle={clip!.name} icon={<Crop size={16} />} />
      <ScrollArea>
        {/* Aspect presets */}
        <Field label="Aspect ratio" hint="Center-crops the clip to this ratio.">
          <div className="grid grid-cols-3 gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                onClick={() => applyAspect(a.ratio)}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-xs font-medium transition',
                  isActive(a.ratio)
                    ? 'border-transparent bg-brand-gradient text-white shadow-glow-sm'
                    : 'border-white/[0.06] bg-black/20 text-white/60 hover:text-white hover:bg-white/[0.05]',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Edge sliders */}
        <Field label="Edges">
          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <Slider label="Left" min={0} max={0.45} step={0.005} value={crop.left} display={pct(crop.left)} onChange={(v) => setCrop({ left: v })} />
            <Slider label="Right" min={0} max={0.45} step={0.005} value={crop.right} display={pct(crop.right)} onChange={(v) => setCrop({ right: v })} />
            <Slider label="Top" min={0} max={0.45} step={0.005} value={crop.top} display={pct(crop.top)} onChange={(v) => setCrop({ top: v })} />
            <Slider label="Bottom" min={0} max={0.45} step={0.005} value={crop.bottom} display={pct(crop.bottom)} onChange={(v) => setCrop({ bottom: v })} />
          </div>
        </Field>

        {/* Flip (handy alongside crop) */}
        <Field label="Flip">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={clip!.transform.flipH ? 'primary' : 'ghost'}
              onClick={() => updateTransform(clip!.id, { flipH: !clip!.transform.flipH })}
            >
              <FlipHorizontal2 size={15} /> Horizontal
            </Button>
            <Button
              variant={clip!.transform.flipV ? 'primary' : 'ghost'}
              onClick={() => updateTransform(clip!.id, { flipV: !clip!.transform.flipV })}
            >
              <FlipVertical2 size={15} /> Vertical
            </Button>
          </div>
        </Field>

        <Button variant="ghost" className="w-full" onClick={() => { commit(); updateTransform(clip!.id, { crop: { ...ZERO } }); }}>
          <RotateCcw size={14} /> Reset crop
        </Button>

        <p className="text-[11px] leading-relaxed text-white/35">
          Cropping re-frames the clip to fill the canvas (cover). Combine with the Adjust panel’s scale &amp; position for fine framing.
        </p>
      </ScrollArea>
    </div>
  );
}
