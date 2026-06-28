'use client';

import { Type, Plus, Bold, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { FONT_FAMILIES } from '@/lib/constants';
import type { TextAlign, TextAnimation, TextStyle } from '@/types/editor';
import {
  PanelHeader,
  ScrollArea,
  Field,
  Slider,
  Segmented,
  ColorInput,
  Toggle,
  Button,
  EmptyState,
} from '@/components/ui/primitives';

const ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'pop', label: 'Pop' },
  { value: 'slideUp', label: 'Slide up' },
  { value: 'slideLeft', label: 'Slide left' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'wave', label: 'Wave' },
];

type Preset = { label: string; preview: React.CSSProperties; previewText: string; style: Partial<TextStyle> };

const PRESETS: Preset[] = [
  {
    label: 'Bold',
    previewText: 'Aa',
    preview: {
      fontFamily: 'Montserrat, Inter, sans-serif',
      fontWeight: 900,
      color: '#ffffff',
      textShadow: '0 3px 10px rgba(0,0,0,0.7)',
    },
    style: {
      text: 'BOLD TITLE',
      fontFamily: 'Montserrat',
      fontSize: 96,
      fontWeight: 900,
      color: '#ffffff',
      align: 'center',
      shadow: { enabled: true, color: '#000000', blur: 16, x: 0, y: 6 },
    },
  },
  {
    label: 'Outline',
    previewText: 'Aa',
    preview: {
      fontFamily: 'Impact, Inter, sans-serif',
      fontWeight: 900,
      color: '#ffffff',
      WebkitTextStroke: '1.5px #000',
    },
    style: {
      text: 'OUTLINE',
      fontFamily: 'Impact',
      fontSize: 100,
      fontWeight: 900,
      color: '#ffffff',
      align: 'center',
      stroke: { enabled: true, color: '#000000', width: 8 },
      shadow: { enabled: false, color: '#000000', blur: 12, x: 0, y: 4 },
    },
  },
  {
    label: 'Caption',
    previewText: 'Aa',
    preview: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      color: '#ffffff',
      background: 'rgba(0,0,0,0.65)',
      borderRadius: '6px',
      padding: '2px 8px',
    },
    style: {
      text: 'Add a caption here',
      fontFamily: 'Inter',
      fontSize: 52,
      fontWeight: 700,
      color: '#ffffff',
      align: 'center',
      background: { enabled: true, color: '#000000', opacity: 0.65, radius: 14, padding: 18 },
      shadow: { enabled: false, color: '#000000', blur: 12, x: 0, y: 4 },
    },
  },
];

export default function TextPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const addTextClip = useEditor((s) => s.addTextClip);
  const updateText = useEditor((s) => s.updateText);

  const addPreset = (preset: Preset) => {
    const id = addTextClip({ text: preset.style.text });
    updateText(id, preset.style);
  };

  const isText = clip?.type === 'text' && !!clip.text;
  const text = isText ? (clip!.text as TextStyle) : null;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Text" subtitle="Titles, captions & animated text" icon={<Type size={18} />} />
      <ScrollArea>
        <Button onClick={() => addTextClip()} className="flex w-full items-center justify-center gap-2 py-2.5">
          <Plus size={15} /> Add text
        </Button>

        <Field label="Title styles">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => addPreset(p)}
                className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] transition hover:border-brand hover:shadow-glow-sm"
              >
                <div className="flex h-12 items-center justify-center bg-black/40">
                  <span style={p.preview} className="text-lg leading-none">
                    {p.previewText}
                  </span>
                </div>
                <div className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white/60 transition group-hover:text-white">
                  {p.label}
                </div>
              </button>
            ))}
          </div>
        </Field>

        {!isText || !text ? (
          <EmptyState
            icon={<Type size={28} />}
            title="No text selected"
            hint="Add a text layer or pick a title style, then select it to edit."
          />
        ) : (
          <div className="space-y-5 border-t border-stroke pt-5">
            <Field label="Content">
              <textarea
                value={text.text}
                onChange={(e) => updateText(clip!.id, { text: e.target.value })}
                rows={3}
                placeholder="Type your text…"
                className="w-full resize-y rounded-md border border-stroke bg-panel-3 px-2.5 py-2 text-xs text-white/80 outline-none focus:border-brand"
              />
            </Field>

            <Field label="Font">
              <select
                value={text.fontFamily}
                onChange={(e) => updateText(clip!.id, { fontFamily: e.target.value })}
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
              value={text.fontSize}
              min={12}
              max={200}
              step={1}
              display={`${Math.round(text.fontSize)}px`}
              onChange={(v) => updateText(clip!.id, { fontSize: v })}
            />

            <Field label="Color">
              <ColorInput value={text.color} onChange={(v) => updateText(clip!.id, { color: v })} />
            </Field>

            <Field label="Weight">
              <Segmented<string>
                value={String(text.fontWeight)}
                onChange={(v) => updateText(clip!.id, { fontWeight: parseInt(v, 10) })}
                options={[
                  { value: '400', label: 'Regular' },
                  { value: '700', label: <Bold size={13} className="mx-auto" /> },
                  { value: '900', label: 'Black' },
                ]}
              />
            </Field>

            <div className="flex items-center gap-4">
              <Toggle
                checked={text.italic}
                onChange={(v) => updateText(clip!.id, { italic: v })}
                label="Italic"
              />
              <Toggle
                checked={text.underline}
                onChange={(v) => updateText(clip!.id, { underline: v })}
                label="Underline"
              />
            </div>

            <Field label="Align">
              <Segmented<TextAlign>
                value={text.align}
                onChange={(v) => updateText(clip!.id, { align: v })}
                options={[
                  { value: 'left', label: <AlignLeft size={14} className="mx-auto" /> },
                  { value: 'center', label: <AlignCenter size={14} className="mx-auto" /> },
                  { value: 'right', label: <AlignRight size={14} className="mx-auto" /> },
                ]}
              />
            </Field>

            <Slider
              label="Line height"
              value={text.lineHeight}
              min={0.8}
              max={2}
              step={0.05}
              display={text.lineHeight.toFixed(2)}
              onChange={(v) => updateText(clip!.id, { lineHeight: v })}
            />

            <Slider
              label="Letter spacing"
              value={text.letterSpacing}
              min={-5}
              max={20}
              step={0.5}
              display={`${text.letterSpacing.toFixed(1)}px`}
              onChange={(v) => updateText(clip!.id, { letterSpacing: v })}
            />

            {/* Background pill */}
            <Section
              title="Background"
              enabled={text.background.enabled}
              onToggle={(v) => updateText(clip!.id, { background: { ...text.background, enabled: v } })}
            >
              <Field label="Color">
                <ColorInput
                  value={text.background.color}
                  onChange={(v) => updateText(clip!.id, { background: { ...text.background, color: v } })}
                />
              </Field>
              <Slider
                label="Opacity"
                value={text.background.opacity}
                min={0}
                max={1}
                display={text.background.opacity.toFixed(2)}
                onChange={(v) => updateText(clip!.id, { background: { ...text.background, opacity: v } })}
              />
              <Slider
                label="Radius"
                value={text.background.radius}
                min={0}
                max={80}
                step={1}
                display={`${Math.round(text.background.radius)}px`}
                onChange={(v) => updateText(clip!.id, { background: { ...text.background, radius: v } })}
              />
              <Slider
                label="Padding"
                value={text.background.padding}
                min={0}
                max={80}
                step={1}
                display={`${Math.round(text.background.padding)}px`}
                onChange={(v) => updateText(clip!.id, { background: { ...text.background, padding: v } })}
              />
            </Section>

            {/* Stroke */}
            <Section
              title="Stroke"
              enabled={text.stroke.enabled}
              onToggle={(v) => updateText(clip!.id, { stroke: { ...text.stroke, enabled: v } })}
            >
              <Field label="Color">
                <ColorInput
                  value={text.stroke.color}
                  onChange={(v) => updateText(clip!.id, { stroke: { ...text.stroke, color: v } })}
                />
              </Field>
              <Slider
                label="Width"
                value={text.stroke.width}
                min={0}
                max={40}
                step={1}
                display={`${Math.round(text.stroke.width)}px`}
                onChange={(v) => updateText(clip!.id, { stroke: { ...text.stroke, width: v } })}
              />
            </Section>

            {/* Shadow */}
            <Section
              title="Shadow"
              enabled={text.shadow.enabled}
              onToggle={(v) => updateText(clip!.id, { shadow: { ...text.shadow, enabled: v } })}
            >
              <Field label="Color">
                <ColorInput
                  value={text.shadow.color}
                  onChange={(v) => updateText(clip!.id, { shadow: { ...text.shadow, color: v } })}
                />
              </Field>
              <Slider
                label="Blur"
                value={text.shadow.blur}
                min={0}
                max={60}
                step={1}
                display={`${Math.round(text.shadow.blur)}px`}
                onChange={(v) => updateText(clip!.id, { shadow: { ...text.shadow, blur: v } })}
              />
              <Slider
                label="Offset X"
                value={text.shadow.x}
                min={-40}
                max={40}
                step={1}
                display={`${Math.round(text.shadow.x)}px`}
                onChange={(v) => updateText(clip!.id, { shadow: { ...text.shadow, x: v } })}
              />
              <Slider
                label="Offset Y"
                value={text.shadow.y}
                min={-40}
                max={40}
                step={1}
                display={`${Math.round(text.shadow.y)}px`}
                onChange={(v) => updateText(clip!.id, { shadow: { ...text.shadow, y: v } })}
              />
            </Section>

            <div className="grid grid-cols-2 gap-3 border-t border-stroke pt-5">
              <Field label="Animate in">
                <AnimSelect value={text.animationIn} onChange={(v) => updateText(clip!.id, { animationIn: v })} />
              </Field>
              <Field label="Animate out">
                <AnimSelect value={text.animationOut} onChange={(v) => updateText(clip!.id, { animationOut: v })} />
              </Field>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function AnimSelect({ value, onChange }: { value: TextAnimation; onChange: (v: TextAnimation) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TextAnimation)}
      className="w-full rounded-md border border-stroke bg-panel-3 px-2 py-2 text-xs text-white/80 outline-none focus:border-brand"
    >
      {ANIMATIONS.map((a) => (
        <option key={a.value} value={a.value}>
          {a.label}
        </option>
      ))}
    </select>
  );
}

function Section({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border p-3 transition',
        enabled ? 'border-white/[0.1] bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.02]',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{title}</span>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && <div className="space-y-3">{children}</div>}
    </div>
  );
}
