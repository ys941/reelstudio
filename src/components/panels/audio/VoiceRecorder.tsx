'use client';

import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Mic, Square, AlertCircle, Loader2 } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import type { MediaAsset } from '@/types/editor';
import { cn, formatTime } from '@/lib/utils';

type RecState = 'idle' | 'recording' | 'saving';

/**
 * Records a voiceover from the microphone (getUserMedia + MediaRecorder), then
 * adds it to the media library and drops an audio clip at the playhead.
 */
export default function VoiceRecorder() {
  const addMediaAsset = useEditor((s) => s.addMediaAsset);
  const addClipFromAsset = useEditor((s) => s.addClipFromAsset);

  const [state, setState] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const finalize = () => {
    const dur = Math.max(0.1, (performance.now() - startRef.current) / 1000);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
    if (blob.size === 0) {
      setError('Nothing was recorded.');
      setState('idle');
      return;
    }
    const url = URL.createObjectURL(blob);
    const count = useEditor.getState().mediaAssets.filter((a) => a.name.startsWith('Voiceover')).length + 1;
    const asset: MediaAsset = {
      id: nanoid(8),
      type: 'audio',
      name: `Voiceover ${count}`,
      url,
      duration: dur,
      width: 0,
      height: 0,
      fileSize: blob.size,
      createdAt: Date.now(),
    };
    addMediaAsset(asset);
    // Drop the recording at the current playhead position.
    addClipFromAsset(asset.id, { start: useEditor.getState().currentTime });
    setState('idle');
    setElapsed(0);
  };

  const start = async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = finalize;
      recRef.current = rec;
      rec.start();
      startRef.current = performance.now();
      setElapsed(0);
      setState('recording');
      timerRef.current = window.setInterval(() => {
        setElapsed((performance.now() - startRef.current) / 1000);
      }, 100);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(
        name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow mic access and try again.'
          : 'Could not access the microphone.',
      );
      setState('idle');
    }
  };

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setState('saving');
    try {
      recRef.current?.stop();
    } catch {
      setState('idle');
    }
  };

  const recording = state === 'recording';

  return (
    <section className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 shadow-inner-hairline">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition',
            recording ? 'bg-red-500/15 text-red-400' : 'bg-brand-gradient-soft text-brand-2',
          )}
        >
          <Mic size={14} />
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-white">Voiceover</h3>
          <p className="text-[10px] uppercase tracking-wide text-white/30">
            {recording ? 'Recording…' : 'Record from your mic'}
          </p>
        </div>
        {recording && (
          <span className="ml-auto flex items-center gap-2 text-[11px] font-medium tabular-nums text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {formatTime(elapsed)}
          </span>
        )}
      </div>

      {state === 'idle' && (
        <button
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-3 py-2.5 text-xs font-semibold text-white shadow-brand transition hover:brightness-110"
        >
          <Mic size={15} /> Record voiceover
        </button>
      )}

      {recording && (
        <button
          onClick={stop}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.35)] transition hover:bg-red-600"
        >
          <Square size={13} className="fill-white" /> Stop &amp; add to timeline
        </button>
      )}

      {state === 'saving' && (
        <button
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-xs font-semibold text-white/60"
        >
          <Loader2 size={14} className="animate-spin" /> Saving…
        </button>
      )}

      <p className="text-[10px] leading-relaxed text-white/30">
        The clip is added on an audio track at the playhead. You can trim, fade and adjust its volume below.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}
