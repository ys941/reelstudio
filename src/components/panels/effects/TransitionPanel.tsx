'use client';

import { useEditor } from '@/store/editorStore';
import {
  EmptyState,
  Field,
  PanelHeader,
  ScrollArea,
  Slider,
} from '@/components/ui/primitives';
import { TRANSITIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  ArrowRightLeft,
  Ban,
  Sparkles,
  Blend,
  MoveHorizontal,
  Eraser,
  ZoomIn,
  Droplets,
  Zap,
  Wind,
  Check,
} from 'lucide-react';
import type { TransitionType } from '@/types/editor';
import type { ReactNode } from 'react';

const TRANSITION_ICONS: Record<TransitionType, ReactNode> = {
  none: <Ban size={16} />,
  fade: <Sparkles size={16} />,
  dissolve: <Blend size={16} />,
  slide: <MoveHorizontal size={16} />,
  wipe: <Eraser size={16} />,
  zoom: <ZoomIn size={16} />,
  blur: <Droplets size={16} />,
  glitch: <Zap size={16} />,
  whip: <Wind size={16} />,
};

export default function TransitionPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const setTransition = useEditor((s) => s.setTransition);

  if (!clip) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          title="Transition"
          subtitle="Entrance between clips"
          icon={<ArrowRightLeft size={16} />}
        />
        <EmptyState
          icon={<ArrowRightLeft size={28} />}
          title="Select a clip"
          hint="Pick a clip on the timeline to set the transition that plays as it enters."
        />
      </div>
    );
  }

  const t = clip.transitionIn;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Transition"
        subtitle="Entrance between clips"
        icon={<ArrowRightLeft size={16} />}
      />
      <ScrollArea>
        <Field label="Transition Type" hint="Applies as the clip enters.">
          <div className="grid grid-cols-3 gap-2">
            {TRANSITIONS.map(({ key, label }) => {
              const active = t.type === key;
              return (
                <button
                  key={key}
                  onClick={() => setTransition(clip.id, { type: key, duration: t.duration })}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-1.5 rounded-lg border py-3 transition',
                    active
                      ? 'border-brand bg-brand/10 text-white ring-2 ring-brand/40'
                      : 'border-stroke bg-panel-3 text-white/55 hover:text-white',
                  )}
                >
                  {active && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white shadow">
                      <Check size={11} />
                    </span>
                  )}
                  <span className={active ? 'text-brand-2' : 'text-white/50'}>
                    {TRANSITION_ICONS[key]}
                  </span>
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Duration"
          hint={
            t.type === 'none'
              ? 'Pick a transition type to enable duration.'
              : undefined
          }
        >
          <div
            className={cn(
              'transition',
              t.type === 'none' ? 'pointer-events-none opacity-40' : 'opacity-100',
            )}
          >
            <Slider
              label="Length"
              value={t.duration}
              min={0.1}
              max={2}
              step={0.05}
              display={`${t.duration.toFixed(2)}s`}
              onChange={(v) => setTransition(clip.id, { type: t.type, duration: v })}
            />
          </div>
        </Field>
      </ScrollArea>
    </div>
  );
}
