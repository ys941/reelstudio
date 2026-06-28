'use client';

import { useEditor } from '@/store/editorStore';
import {
  ColorInput,
  EmptyState,
  Field,
  PanelHeader,
  ScrollArea,
  Slider,
  Toggle,
} from '@/components/ui/primitives';
import { FILTER_PRESETS } from '@/lib/constants';
import type { FilterPreset } from '@/types/editor';
import { cn } from '@/lib/utils';
import { Wand2, Check } from 'lucide-react';

// Approximate each preset look as a CSS filter for the swatch thumbnails.
const PRESET_CSS: Record<FilterPreset, string> = {
  none: 'none',
  vivid: 'saturate(1.6) contrast(1.15)',
  warm: 'sepia(0.25) saturate(1.3) hue-rotate(-12deg) brightness(1.05)',
  cool: 'saturate(1.1) hue-rotate(18deg) brightness(1.02) contrast(1.05)',
  mono: 'grayscale(1) contrast(1.05)',
  sepia: 'sepia(0.85) saturate(1.1) brightness(1.05)',
  noir: 'grayscale(1) contrast(1.5) brightness(0.9)',
  fade: 'contrast(0.82) brightness(1.1) saturate(0.85)',
  vintage: 'sepia(0.4) saturate(1.3) contrast(1.1) hue-rotate(-8deg)',
  cinematic: 'contrast(1.2) saturate(1.15) brightness(0.96) hue-rotate(-6deg)',
};

const THUMB_GRADIENT =
  'linear-gradient(135deg, #ff8a3d 0%, #f43f9d 35%, #6366f1 70%, #22d3ee 100%)';

function pct01(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export default function EffectsPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const updateAdjustments = useEditor((s) => s.updateAdjustments);
  const updateChroma = useEditor((s) => s.updateChroma);

  if (!clip) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          title="Effects"
          subtitle="Filters & chroma key"
          icon={<Wand2 size={16} />}
        />
        <EmptyState
          icon={<Wand2 size={28} />}
          title="Select a clip"
          hint="Pick a clip on the timeline to apply filter presets or a green-screen key."
        />
      </div>
    );
  }

  const adj = clip.adjustments;
  const chroma = clip.chroma;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Effects"
        subtitle="Filters & chroma key"
        icon={<Wand2 size={16} />}
      />
      <ScrollArea>
        <Field label="Filter Preset">
          <div className="grid grid-cols-3 gap-2">
            {FILTER_PRESETS.map(({ key, label }) => {
              const active = adj.preset === key;
              return (
                <button
                  key={key}
                  onClick={() => updateAdjustments(clip.id, { preset: key })}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border text-left transition',
                    active
                      ? 'border-brand ring-2 ring-brand/40'
                      : 'border-stroke hover:border-white/30',
                  )}
                >
                  <div
                    className="h-12 w-full"
                    style={{ background: THUMB_GRADIENT, filter: PRESET_CSS[key] }}
                  />
                  {active && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white shadow">
                      <Check size={11} />
                    </span>
                  )}
                  <div className="truncate px-1.5 py-1 text-[10px] font-medium text-white/70">
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Preset Strength">
          <Slider
            label="Intensity"
            value={adj.presetStrength}
            min={0}
            max={1}
            step={0.01}
            display={pct01(adj.presetStrength)}
            onChange={(v) => updateAdjustments(clip.id, { presetStrength: v })}
          />
        </Field>

        <div className="border-t border-stroke pt-4">
          <Field
            label="Chroma Key"
            hint="Removes a solid background color (green screen)."
            right={
              <Toggle
                checked={chroma.enabled}
                onChange={(v) => updateChroma(clip.id, { enabled: v })}
              />
            }
          >
            <div
              className={cn(
                'space-y-3 transition',
                chroma.enabled ? 'opacity-100' : 'pointer-events-none opacity-40',
              )}
            >
              <div>
                <div className="mb-1.5 text-[11px] text-white/50">Key color</div>
                <ColorInput
                  value={chroma.color}
                  onChange={(v) => updateChroma(clip.id, { color: v })}
                />
              </div>
              <Slider
                label="Similarity"
                value={chroma.similarity}
                min={0}
                max={1}
                step={0.01}
                display={pct01(chroma.similarity)}
                onChange={(v) => updateChroma(clip.id, { similarity: v })}
              />
              <Slider
                label="Smoothness"
                value={chroma.smoothness}
                min={0}
                max={1}
                step={0.01}
                display={pct01(chroma.smoothness)}
                onChange={(v) => updateChroma(clip.id, { smoothness: v })}
              />
              <Slider
                label="Spill"
                value={chroma.spill}
                min={0}
                max={1}
                step={0.01}
                display={pct01(chroma.spill)}
                onChange={(v) => updateChroma(clip.id, { spill: v })}
              />
            </div>
          </Field>
        </div>
      </ScrollArea>
    </div>
  );
}
