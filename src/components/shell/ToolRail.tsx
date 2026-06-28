'use client';

import { useEditor } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { PanelKey } from '@/types/editor';
import {
  Film,
  Music,
  Type,
  Layers,
  Sticker,
  Sparkles,
  SlidersHorizontal,
  Crop,
  Gauge,
  Shuffle,
  Stamp,
  Download,
} from 'lucide-react';

type Item = { key: PanelKey; label: string; icon: React.ReactNode };

// Grouped for a clearer visual hierarchy (hairline separators between groups).
const GROUPS: Item[][] = [
  [
    { key: 'media', label: 'Media', icon: <Film size={19} /> },
    { key: 'audio', label: 'Audio', icon: <Music size={19} /> },
  ],
  [
    { key: 'text', label: 'Text', icon: <Type size={19} /> },
    { key: 'overlay', label: 'Overlay', icon: <Layers size={19} /> },
    { key: 'sticker', label: 'Sticker', icon: <Sticker size={19} /> },
  ],
  [
    { key: 'effects', label: 'Effects', icon: <Sparkles size={19} /> },
    { key: 'adjust', label: 'Adjust', icon: <SlidersHorizontal size={19} /> },
    { key: 'crop', label: 'Crop', icon: <Crop size={19} /> },
    { key: 'speed', label: 'Speed', icon: <Gauge size={19} /> },
    { key: 'transition', label: 'Trans.', icon: <Shuffle size={19} /> },
  ],
  [
    { key: 'watermark', label: 'Mark', icon: <Stamp size={19} /> },
    { key: 'export', label: 'Export', icon: <Download size={19} /> },
  ],
];

export default function ToolRail() {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-white/[0.06] bg-white/[0.02] py-3 backdrop-blur-xl">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex w-full flex-col items-center gap-1.5">
          {gi > 0 && <div className="my-1 h-px w-8 bg-white/[0.06]" />}
          {group.map((it) => {
            const active = panel === it.key;
            return (
              <button
                key={it.key}
                onClick={() => setPanel(it.key)}
                title={it.label}
                className={cn(
                  'group relative flex w-[60px] flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors duration-150',
                  active ? 'text-white' : 'text-white/45 hover:text-white/85',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-active"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    className="absolute inset-0 rounded-xl bg-brand-gradient-soft ring-1 ring-inset ring-white/10"
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="rail-bar"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    className="absolute -left-px top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient shadow-glow-sm"
                  />
                )}
                <span className={cn('relative z-10 transition-transform group-active:scale-90', active && 'text-brand-2')}>
                  {it.icon}
                </span>
                <span className="relative z-10">{it.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
