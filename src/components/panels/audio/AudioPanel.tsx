'use client';

import { nanoid } from 'nanoid';
import { Music, Volume2, VolumeX, AudioWaveform, Scissors } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import type { Clip, MediaAsset, Track } from '@/types/editor';
import { cn } from '@/lib/utils';
import {
  PanelHeader,
  Field,
  Slider,
  Toggle,
  EmptyState,
  ScrollArea,
} from '@/components/ui/primitives';
import VoiceRecorder from './VoiceRecorder';

// A clip is editable in the audio panel if it carries audio: audio clips
// and video clips (which have an audio track baked in).
function clipHasAudio(clip: Clip): boolean {
  return clip.type === 'audio' || clip.type === 'video';
}

export default function AudioPanel() {
  const selectedClip = useEditor((s) => s.getSelectedClip());
  const tracks = useEditor((s) => s.project.tracks);
  const mediaAssets = useEditor((s) => s.mediaAssets);
  const updateAudio = useEditor((s) => s.updateAudio);
  const toggleTrackMute = useEditor((s) => s.toggleTrackMute);
  const addMediaAsset = useEditor((s) => s.addMediaAsset);
  const addClipFromAsset = useEditor((s) => s.addClipFromAsset);

  const audioTracks = tracks.filter((t) => t.type === 'audio');
  const editableClip = selectedClip && clipHasAudio(selectedClip) ? selectedClip : undefined;

  // Detach a video clip's audio into its own audio-track clip, then mute the
  // video's baked-in audio so it isn't heard twice.
  const extractAudio = (videoClip: Clip) => {
    const asset = mediaAssets.find((a) => a.id === videoClip.assetId);
    if (!asset) return;
    const audioAsset: MediaAsset = {
      id: nanoid(8),
      type: 'audio',
      name: `${asset.name} (audio)`,
      url: asset.url,
      duration: asset.duration || videoClip.duration,
      width: 0,
      height: 0,
      fileSize: asset.fileSize,
      createdAt: Date.now(),
    };
    addMediaAsset(audioAsset);
    addClipFromAsset(audioAsset.id, { start: videoClip.start });
    updateAudio(videoClip.id, { muted: true });
  };

  // Does the project hold any audio at all (audio or video clips on any track)?
  const hasAnyAudio = tracks.some((t) =>
    t.clips.some((c) => c.type === 'audio' || c.type === 'video'),
  );

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Audio"
        subtitle="Mix volume, fades & tracks"
        icon={<AudioWaveform size={16} />}
      />

      <ScrollArea>
        {/* ---- Microphone voiceover ---- */}
        <VoiceRecorder />

        {!hasAnyAudio && !editableClip && (
          <EmptyState
            icon={<Music size={28} />}
            title="No audio yet"
            hint="Record a voiceover above, import audio in the Media tab, or extract audio from a video clip."
          />
        )}

        {/* ---- Clip audio editor ---- */}
        {editableClip ? (
            <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 shadow-inner-hairline">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient-soft text-brand-2">
                  {editableClip.type === 'audio' ? <Music size={14} /> : <Volume2 size={14} />}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-semibold text-white" title={editableClip.name}>
                    {editableClip.name}
                  </h3>
                  <p className="text-[10px] uppercase tracking-wide text-white/30">
                    {editableClip.type === 'audio' ? 'Audio clip' : 'Video clip'}
                  </p>
                </div>
              </div>

              <Field
                label="Volume"
                right={
                  <span className="text-[11px] tabular-nums text-white/60">
                    {Math.round(editableClip.audio.volume * 100)}%
                  </span>
                }
              >
                <Slider
                  value={editableClip.audio.volume}
                  min={0}
                  max={2}
                  step={0.01}
                  onChange={(v) => updateAudio(editableClip.id, { volume: v })}
                />
              </Field>

              <Field label="Mute">
                <Toggle
                  checked={editableClip.audio.muted}
                  onChange={(v) => updateAudio(editableClip.id, { muted: v })}
                  label={editableClip.audio.muted ? 'Muted' : 'Audible'}
                />
              </Field>

              <Field label="Fade in">
                <Slider
                  value={editableClip.audio.fadeIn}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(v) => updateAudio(editableClip.id, { fadeIn: v })}
                  display={`${editableClip.audio.fadeIn.toFixed(1)}s`}
                  label=" "
                />
              </Field>

              <Field label="Fade out">
                <Slider
                  value={editableClip.audio.fadeOut}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(v) => updateAudio(editableClip.id, { fadeOut: v })}
                  display={`${editableClip.audio.fadeOut.toFixed(1)}s`}
                  label=" "
                />
              </Field>

              {editableClip.type === 'video' && editableClip.assetId && (
                <button
                  onClick={() => extractAudio(editableClip)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <Scissors size={14} /> Extract audio to its own track
                </button>
              )}
            </section>
          ) : (
            <div className="rounded-lg border border-dashed border-stroke px-3 py-4 text-center text-[11px] text-white/40">
              Select an audio or video clip to edit its volume and fades.
            </div>
          )}

          {/* ---- Audio tracks ---- */}
          <section className="mt-5 space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">
              Audio tracks
            </h3>
            {audioTracks.length === 0 ? (
              <p className="text-[11px] text-white/30">No audio tracks yet.</p>
            ) : (
              <div className="space-y-2">
                {audioTracks.map((track) => (
                  <AudioTrackRow
                    key={track.id}
                    track={track}
                    onToggleMute={() => toggleTrackMute(track.id)}
                  />
                ))}
              </div>
            )}
          </section>
      </ScrollArea>
    </div>
  );
}

function AudioTrackRow({
  track,
  onToggleMute,
}: {
  track: Track;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 transition hover:border-white/[0.12]">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          track.muted ? 'bg-red-500/10 text-red-400/80' : 'bg-white/[0.04] text-white/40',
        )}
      >
        <Music size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white/80" title={track.name}>
          {track.name}
        </p>
        <p className="text-[10px] text-white/30">
          {track.clips.length} clip{track.clips.length === 1 ? '' : 's'}
        </p>
      </div>
      <button
        onClick={onToggleMute}
        title={track.muted ? 'Unmute track' : 'Mute track'}
        className={cn(
          'flex items-center justify-center rounded-md p-1.5 transition',
          track.muted
            ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
            : 'bg-panel-2 text-white/60 hover:text-white',
        )}
      >
        {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
