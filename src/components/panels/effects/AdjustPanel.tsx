'use client';

import { useEditor } from '@/store/editorStore';
import {
  Button,
  EmptyState,
  Field,
  PanelHeader,
  ScrollArea,
  Slider,
} from '@/components/ui/primitives';
import { DEFAULT_ADJUSTMENTS, type Adjustments } from '@/types/editor';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

// Format a -1..1 (or 0..1) value as a signed percentage.
function pct(v: number): string {
  const n = Math.round(v * 100);
  return `${n > 0 ? '+' : ''}${n}%`;
}

// Format a 0..1 value as a plain percentage.
function pct01(v: number): string {
  return `${Math.round(v * 100)}%`;
}

type AdjKey = Exclude<keyof Adjustments, 'preset' | 'presetStrength'>;

export default function AdjustPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const updateAdjustments = useEditor((s) => s.updateAdjustments);

  if (!clip) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          title="Adjust"
          subtitle="Fine-tune color & light"
          icon={<SlidersHorizontal size={16} />}
        />
        <EmptyState
          icon={<SlidersHorizontal size={28} />}
          title="Select a clip"
          hint="Pick a clip on the timeline to adjust its color, light, and detail."
        />
      </div>
    );
  }

  const adj = clip.adjustments;
  const set = (patch: Partial<Adjustments>) => updateAdjustments(clip.id, patch);

  // Signed sliders: -1..1, displayed as signed percent.
  const signed: { key: AdjKey; label: string }[] = [
    { key: 'brightness', label: 'Brightness' },
    { key: 'contrast', label: 'Contrast' },
    { key: 'saturation', label: 'Saturation' },
    { key: 'exposure', label: 'Exposure' },
    { key: 'temperature', label: 'Temperature' },
    { key: 'tint', label: 'Tint' },
    { key: 'highlights', label: 'Highlights' },
    { key: 'shadows', label: 'Shadows' },
  ];

  // Effect sliders: 0..1, displayed as percent.
  const effects: { key: AdjKey; label: string }[] = [
    { key: 'sharpness', label: 'Sharpness' },
    { key: 'blur', label: 'Blur' },
    { key: 'vignette', label: 'Vignette' },
    { key: 'grain', label: 'Grain' },
  ];

  const resetAll = () =>
    set({
      ...DEFAULT_ADJUSTMENTS,
      // keep the current preset + strength
      preset: adj.preset,
      presetStrength: adj.presetStrength,
    });

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Adjust"
        subtitle="Fine-tune color & light"
        icon={<SlidersHorizontal size={16} />}
      />
      <ScrollArea>
        <Field label="Light & Color">
          <div className="space-y-3">
            {signed.map(({ key, label }) => (
              <Slider
                key={key}
                label={label}
                value={adj[key]}
                min={-1}
                max={1}
                step={0.01}
                display={pct(adj[key])}
                onChange={(v) => set({ [key]: v } as Partial<Adjustments>)}
              />
            ))}
          </div>
        </Field>

        <Field label="Hue">
          <Slider
            label="Hue rotation"
            value={adj.hue}
            min={-180}
            max={180}
            step={1}
            display={`${adj.hue > 0 ? '+' : ''}${Math.round(adj.hue)}°`}
            onChange={(v) => set({ hue: v })}
          />
        </Field>

        <Field label="Detail & Texture">
          <div className="space-y-3">
            {effects.map(({ key, label }) => (
              <Slider
                key={key}
                label={label}
                value={adj[key]}
                min={0}
                max={1}
                step={0.01}
                display={pct01(adj[key])}
                onChange={(v) => set({ [key]: v } as Partial<Adjustments>)}
              />
            ))}
          </div>
        </Field>

        <Button variant="ghost" onClick={resetAll} className="flex w-full items-center justify-center gap-2">
          <RotateCcw size={13} />
          Reset all
        </Button>
      </ScrollArea>
    </div>
  );
}
