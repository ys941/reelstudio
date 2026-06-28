'use client';

import { useEditor } from '@/store/editorStore';
import {
  Button,
  EmptyState,
  Field,
  PanelHeader,
  ScrollArea,
  Slider,
  Toggle,
} from '@/components/ui/primitives';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Gauge, Music2, Info } from 'lucide-react';

const QUICK_RATES = [0.25, 0.5, 1, 1.5, 2, 4];

export default function SpeedPanel() {
  const clip = useEditor((s) => s.getSelectedClip());
  const updateSpeed = useEditor((s) => s.updateSpeed);

  if (!clip) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader
          title="Speed"
          subtitle="Playback rate & timing"
          icon={<Gauge size={16} />}
        />
        <EmptyState
          icon={<Gauge size={28} />}
          title="Select a clip"
          hint="Pick a video or audio clip on the timeline to change its speed."
        />
      </div>
    );
  }

  const speed = clip.speed;
  const isStatic = clip.type === 'text' || clip.type === 'image';

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Speed"
        subtitle="Playback rate & timing"
        icon={<Gauge size={16} />}
      />
      <ScrollArea>
        {isStatic ? (
          <div className="flex items-start gap-2 rounded-lg border border-stroke bg-panel-3 p-3 text-[11px] text-white/50">
            <Info size={14} className="mt-0.5 shrink-0 text-brand-2" />
            <span>
              Speed only applies to video and audio clips. Adjust the duration of this{' '}
              {clip.type} clip by trimming it on the timeline.
            </span>
          </div>
        ) : (
          <>
            <Field label="Quick Speed">
              <div className="grid grid-cols-3 gap-2">
                {QUICK_RATES.map((rate) => {
                  const active = Math.abs(speed.rate - rate) < 0.001;
                  return (
                    <button
                      key={rate}
                      onClick={() => updateSpeed(clip.id, { rate })}
                      className={cn(
                        'rounded-lg border py-2 text-xs font-semibold tabular-nums transition',
                        active
                          ? 'border-transparent bg-brand-gradient text-white shadow-brand'
                          : 'border-white/[0.06] bg-white/[0.03] text-white/60 hover:border-white/[0.14] hover:text-white',
                      )}
                    >
                      {rate}×
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Fine Tune">
              <Slider
                label="Rate"
                value={speed.rate}
                min={0.1}
                max={4}
                step={0.05}
                display={`${speed.rate.toFixed(2)}×`}
                onChange={(v) => updateSpeed(clip.id, { rate: v })}
              />
            </Field>

            <Field
              label="Pitch"
              hint="Keep the original pitch when slowing down or speeding up audio."
              right={
                <Toggle
                  checked={speed.pitchPreserve}
                  onChange={(v) => updateSpeed(clip.id, { pitchPreserve: v })}
                />
              }
            >
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <Music2 size={13} className="text-brand-2" />
                Preserve pitch
              </div>
            </Field>

            <div className="space-y-2 rounded-lg border border-stroke bg-panel-3 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Clip duration</span>
                <span className="font-semibold tabular-nums text-white">
                  {formatTime(clip.duration)}
                </span>
              </div>
              <p className="flex items-start gap-1.5 text-[10px] text-white/30">
                <Info size={11} className="mt-0.5 shrink-0" />
                Changing speed also changes the audio length of this clip.
              </p>
            </div>

            <Button
              variant="ghost"
              onClick={() => updateSpeed(clip.id, { rate: 1 })}
              className="w-full"
              disabled={Math.abs(speed.rate - 1) < 0.001}
            >
              Reset to 1×
            </Button>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
