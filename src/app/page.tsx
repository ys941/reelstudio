'use client';

import { useEditor } from '@/store/editorStore';
import { AnimatePresence, motion } from 'framer-motion';
import type { PanelKey } from '@/types/editor';

import TopBar from '@/components/shell/TopBar';
import ToolRail from '@/components/shell/ToolRail';
import Footer from '@/components/shell/Footer';
import PreviewStage from '@/components/preview/PreviewStage';
import Timeline from '@/components/timeline/Timeline';

import MediaPanel from '@/components/panels/media/MediaPanel';
import AudioPanel from '@/components/panels/audio/AudioPanel';
import TextPanel from '@/components/panels/text/TextPanel';
import OverlayPanel from '@/components/panels/overlay/OverlayPanel';
import StickerPanel from '@/components/panels/overlay/StickerPanel';
import EffectsPanel from '@/components/panels/effects/EffectsPanel';
import AdjustPanel from '@/components/panels/effects/AdjustPanel';
import CropPanel from '@/components/panels/crop/CropPanel';
import SpeedPanel from '@/components/panels/effects/SpeedPanel';
import TransitionPanel from '@/components/panels/effects/TransitionPanel';
import WatermarkPanel from '@/components/panels/watermark/WatermarkPanel';
import ExportPanel from '@/components/export/ExportPanel';

const PANELS: Record<PanelKey, React.ComponentType> = {
  media: MediaPanel,
  audio: AudioPanel,
  text: TextPanel,
  overlay: OverlayPanel,
  sticker: StickerPanel,
  effects: EffectsPanel,
  adjust: AdjustPanel,
  crop: CropPanel,
  speed: SpeedPanel,
  transition: TransitionPanel,
  watermark: WatermarkPanel,
  export: ExportPanel,
};

export default function EditorPage() {
  const panel = useEditor((s) => s.panel);
  const ActivePanel = PANELS[panel];

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas text-white">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <aside className="flex w-[340px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={panel}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <ActivePanel />
            </motion.div>
          </AnimatePresence>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center p-5">
            <PreviewStage />
          </div>
          <Timeline />
        </main>
      </div>
      <Footer />
    </div>
  );
}
