'use client';

import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer className="flex h-9 shrink-0 items-center justify-center gap-1.5 border-t border-white/[0.06] bg-white/[0.02] text-[11.5px] text-white/45 backdrop-blur-xl">
      <span>Made with</span>
      <motion.span
        role="img"
        aria-label="love"
        className="inline-block text-sm"
        animate={{ scale: [1, 1.35, 1, 1.2, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.4, 0.55, 1] }}
        style={{ filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.55))' }}
      >
        ❤️
      </motion.span>
      <span>by</span>
      <span className="bg-brand-gradient bg-clip-text font-semibold text-transparent">Yati Bhardwaj</span>
      <span className="text-white/20">·</span>
      <a
        href="https://github.com/ys941"
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/40 underline-offset-2 transition hover:text-white/70 hover:underline"
      >
        github.com/ys941
      </a>
    </footer>
  );
}
