'use client';

// =============================================================================
// ExportPanel — configure & run an export. Binds settings to the store, renders
// a live summary, and drives exportVideo() with progress + cancel support.
// =============================================================================

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Film, Gauge, Loader2, Ratio, Sparkles, Timer, X } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { download, formatTime } from '@/lib/utils';
import { Button, Field, PanelHeader, ScrollArea, Segmented, Toggle } from '@/components/ui/primitives';
import { exportVideo, outputDimensions, projectDuration } from '@/lib/export/exporter';
import type { ExportFormat, ExportQuality } from '@/types/editor';

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'gif', label: 'GIF' },
];

const QUALITY_OPTIONS: { value: ExportQuality; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

const FPS_OPTIONS: { value: string; label: string }[] = [
  { value: '24', label: '24' },
  { value: '30', label: '30' },
  { value: '60', label: '60' },
];

const SCALE_OPTIONS: { value: string; label: string }[] = [
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
];

export default function ExportPanel() {
  const project = useEditor((s) => s.project);
  const mediaAssets = useEditor((s) => s.mediaAssets);
  const settings = useEditor((s) => s.exportSettings);
  const updateExportSettings = useEditor((s) => s.updateExportSettings);
  const isExporting = useEditor((s) => s.isExporting);
  const exportProgress = useEditor((s) => s.exportProgress);
  const exportStage = useEditor((s) => s.exportStage);
  const setExporting = useEditor((s) => s.setExporting);
  const setExportProgress = useEditor((s) => s.setExportProgress);

  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dims = outputDimensions(project, settings);
  const duration = projectDuration(project);
  const empty = duration <= 0;

  const onExport = async () => {
    if (isExporting) return;
    setError(null);
    setSavedName(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    setExportProgress(0, 'Preparing…');
    try {
      const { blob, filename } = await exportVideo({
        project,
        assets: mediaAssets,
        settings,
        signal: controller.signal,
        onProgress: (p, stage) => setExportProgress(p, stage),
      });
      download(blob, filename);
      setExportProgress(1, 'Saved');
      setSavedName(filename);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      if (msg !== 'Export cancelled.') setError(msg);
    } finally {
      setExporting(false);
      abortRef.current = null;
    }
  };

  const onCancel = () => {
    abortRef.current?.abort();
  };

  const pct = Math.round((exportProgress || 0) * 100);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Export" subtitle="Render your reel to a file" icon={<Download size={16} />} />
      <ScrollArea>
        <Field label="Format">
          <Segmented<ExportFormat>
            value={settings.format}
            options={FORMAT_OPTIONS}
            onChange={(v) => updateExportSettings({ format: v })}
          />
        </Field>

        <Field label="Quality" hint="Higher quality = larger file size.">
          <Segmented<ExportQuality>
            value={settings.quality}
            options={QUALITY_OPTIONS}
            onChange={(v) => updateExportSettings({ quality: v })}
          />
        </Field>

        <Field label="Frame rate">
          <Segmented<string>
            value={String(settings.fps)}
            options={FPS_OPTIONS}
            onChange={(v) => updateExportSettings({ fps: parseInt(v, 10) })}
          />
        </Field>

        <Field label="Resolution scale" hint={`Relative to ${project.aspectRatio.width}×${project.aspectRatio.height}.`}>
          <Segmented<string>
            value={String(settings.resolutionScale)}
            options={SCALE_OPTIONS}
            onChange={(v) => updateExportSettings({ resolutionScale: parseFloat(v) })}
          />
        </Field>

        <Field label="Watermark">
          <Toggle
            checked={settings.includeWatermark}
            onChange={(v) => updateExportSettings({ includeWatermark: v })}
            label={settings.includeWatermark ? 'Include watermark' : 'No watermark'}
          />
          {settings.includeWatermark && !project.watermark.enabled && (
            <p className="text-[10px] text-white/30">Watermark is currently disabled in the Watermark panel.</p>
          )}
        </Field>

        {/* Summary card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-inner-hairline">
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-brand-gradient-soft px-3 py-2">
            <Sparkles size={13} className="text-brand-2" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Export summary
            </span>
          </div>
          <div className="space-y-2 p-3">
            <SummaryRow icon={<Ratio size={13} />} label="Output" value={`${dims.width} × ${dims.height}`} />
            <SummaryRow icon={<Timer size={13} />} label="Duration" value={formatTime(duration)} />
            <SummaryRow icon={<Gauge size={13} />} label="Frame rate" value={`${settings.fps} fps`} />
            <SummaryRow
              icon={<Film size={13} />}
              label="Format"
              value={settings.format.toUpperCase()}
            />
            <p className="pt-1 text-[10px] leading-relaxed text-white/30">
              Renders in real time using your browser — keep this tab focused for best results.
              {settings.format === 'gif' && ' GIF conversion may take extra time.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {!isExporting && savedName && !error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-[11px] text-emerald-300"
          >
            <CheckCircle2 size={15} className="shrink-0" />
            <span className="min-w-0">
              Saved <span className="font-semibold text-emerald-200">{savedName}</span>
            </span>
          </motion.div>
        )}

        {isExporting ? (
          <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin text-brand-2" />
                  {exportStage || 'Working…'}
                </span>
                <span className="tabular-nums font-semibold text-white/80">{pct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/40 shadow-inner-hairline">
                <div
                  className="relative h-full rounded-full bg-brand-gradient transition-[width] duration-150"
                  style={{ width: `${Math.max(pct, 3)}%` }}
                >
                  <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <Button variant="danger" className="w-full" onClick={onCancel}>
              <span className="flex items-center justify-center gap-1.5">
                <X size={14} /> Cancel export
              </span>
            </Button>
          </div>
        ) : (
          <motion.button
            whileHover={empty ? undefined : { scale: 1.015 }}
            whileTap={empty ? undefined : { scale: 0.985 }}
            onClick={onExport}
            disabled={empty}
            className={
              empty
                ? 'w-full cursor-not-allowed rounded-xl border border-white/[0.06] bg-white/[0.03] py-3.5 text-sm font-semibold text-white/30'
                : 'w-full rounded-xl bg-brand-gradient py-3.5 text-sm font-bold text-white shadow-brand transition'
            }
          >
            <span className="flex items-center justify-center gap-2">
              <Download size={16} />
              {empty ? 'Timeline is empty' : 'Export video'}
            </span>
          </motion.button>
        )}
      </ScrollArea>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-2 text-white/40">
        {icon}
        {label}
      </span>
      <span className="font-medium tabular-nums text-white/80">{value}</span>
    </div>
  );
}
