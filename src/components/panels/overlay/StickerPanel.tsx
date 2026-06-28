'use client';

import { Sticker, ImageIcon } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { PanelHeader, ScrollArea, Field, EmptyState } from '@/components/ui/primitives';

const EMOJIS = [
  // faces / reactions
  '😀', '😂', '😍', '🥹', '😎', '🤔', '😱', '🥳',
  // hands / gestures
  '👍', '👏', '🙌', '🙏', '👀', '💪', '✌️', '🤝',
  // hearts / sparkle
  '❤️', '🔥', '✨', '⭐', '💯', '🎉', '🎊', '💥',
  // symbols
  '⚡', '💎', '🚀', '👑', '🏆', '🎯', '💡', '📈',
  // nature / misc
  '🌈', '☀️', '🌙', '🌸', '🍀', '🦄', '🎵', '💸',
];

export default function StickerPanel() {
  const mediaAssets = useEditor((s) => s.mediaAssets);
  const addTextClip = useEditor((s) => s.addTextClip);
  const updateText = useEditor((s) => s.updateText);
  const addOverlayClip = useEditor((s) => s.addOverlayClip);

  const imageAssets = mediaAssets.filter((a) => a.type === 'image');

  const addEmoji = (emoji: string) => {
    const id = addTextClip({ text: emoji });
    updateText(id, {
      fontSize: 160,
      background: { enabled: false, color: '#000000', opacity: 0.5, radius: 12, padding: 16 },
      stroke: { enabled: false, color: '#000000', width: 4 },
      shadow: { enabled: false, color: '#000000', blur: 12, x: 0, y: 4 },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Stickers" subtitle="Emoji & image stickers" icon={<Sticker size={18} />} />
      <ScrollArea>
        <Field label="Emoji">
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => addEmoji(e)}
                title="Add sticker"
                className="flex aspect-square items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-xl transition hover:z-10 hover:scale-125 hover:border-brand hover:bg-brand-gradient-soft hover:shadow-glow-sm"
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Image stickers">
          {imageAssets.length === 0 ? (
            <EmptyState
              icon={<ImageIcon size={26} />}
              title="No image stickers"
              hint="Import PNGs or images in the Media panel to use them as stickers."
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {imageAssets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addOverlayClip(a.id)}
                  title={a.name}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] transition hover:border-brand hover:shadow-glow-sm"
                >
                  {a.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnail}
                      alt={a.name}
                      className="h-full w-full object-contain p-1 transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/30">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur">
                    {a.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Field>
      </ScrollArea>
    </div>
  );
}
