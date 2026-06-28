'use client';

import { useEditor } from '@/store/editorStore';
import { ASPECT_RATIOS } from '@/lib/constants';
import type { AspectRatioKey } from '@/types/editor';
import { Undo2, Redo2, Magnet, Download, Clapperboard } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

function IconButton({
  onClick,
  title,
  active,
  disabled,
  children,
}: {
  onClick?: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-lg transition-colors',
        active
          ? 'bg-brand-gradient-soft text-brand-2 ring-1 ring-inset ring-white/10'
          : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
        disabled && 'pointer-events-none opacity-30',
      )}
    >
      {children}
    </motion.button>
  );
}

export default function TopBar() {
  const project = useEditor((s) => s.project);
  const setProjectName = useEditor((s) => s.setProjectName);
  const setAspectRatio = useEditor((s) => s.setAspectRatio);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const snap = useEditor((s) => s.snapEnabled);
  const setSnap = useEditor((s) => s.setSnap);
  const setPanel = useEditor((s) => s.setPanel);
  const canUndo = useEditor((s) => s._past.length > 0);
  const canRedo = useEditor((s) => s._future.length > 0);

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 backdrop-blur-xl">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient shadow-brand">
          <Clapperboard size={16} className="text-white" />
        </div>
        <span className="bg-brand-gradient bg-clip-text text-sm font-bold tracking-tightest text-transparent">
          ReelStudio
        </span>
      </div>

      <div className="mx-1 h-5 w-px bg-white/[0.08]" />

      <input
        value={project.name}
        onChange={(e) => setProjectName(e.target.value)}
        spellCheck={false}
        className="w-52 rounded-lg bg-transparent px-2.5 py-1.5 text-sm font-medium text-white/80 outline-none transition hover:bg-white/[0.05] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/10"
      />

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <select
            value={project.aspectRatio.key}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatioKey)}
            className="cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 pl-3 pr-7 text-xs font-medium text-white/75 outline-none transition hover:bg-white/[0.07] focus:ring-2 focus:ring-brand/20"
          >
            {Object.values(ASPECT_RATIOS).map((a) => (
              <option key={a.key} value={a.key} className="bg-panel text-white">
                {a.key} · {a.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="mx-0.5 h-5 w-px bg-white/[0.08]" />

        <IconButton onClick={() => setSnap(!snap)} title="Snap to grid" active={snap}>
          <Magnet size={16} />
        </IconButton>
        <IconButton onClick={undo} disabled={!canUndo} title="Undo">
          <Undo2 size={16} />
        </IconButton>
        <IconButton onClick={redo} disabled={!canRedo} title="Redo">
          <Redo2 size={16} />
        </IconButton>

        <div className="mx-0.5 h-5 w-px bg-white/[0.08]" />

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          onClick={() => setPanel('export')}
          className="flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-white shadow-brand transition hover:brightness-110"
        >
          <Download size={15} />
          Export
        </motion.button>
      </div>
    </div>
  );
}
