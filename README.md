<div align="center">

# 🎬 ReelStudio

### A full-featured, VN-style video editor that runs entirely in your browser.

Multi-track timeline · canvas preview · filters · text · stickers · overlays · **crop** · **watermarks** · in-browser export — no installs, no uploads, 100% client-side.

<br/>

![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/State-Zustand-443E38?style=for-the-badge)
![FFmpeg.wasm](https://img.shields.io/badge/Export-FFmpeg.wasm-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)

<br/>

```
┌──────────────────────────────────────────────────────────────────┐
│  🎬 ReelStudio      Untitled project           9:16 ▾  ⤺ ⤻  ⬇ Export │
├────┬─────────────────────┬───────────────────────────────────────┤
│ 🎞  │                     │                                       │
│ 🎵  │   ◀ active panel ▶  │            � preview canvas ▾          │
│ 🔤  │                     │                                       │
│ ▦  │   (media / text /   │          [  9:16  reel  ]             │
│ ✦  │    crop / fx / ...)  │                                       │
│ ⏱  │                     │     ⏮  ▶  ⏭   00:00 ──────── 00:12     │
│ ⬇  ├─────────────────────┴───────────────────────────────────────┤
│    │  ▶ 00:00:00:00   ✂ ⧉ 🗑   + Track   🧲   ⊖ 50px/s ⊕          │
│    │  ▏·····│·····│·····│·····│·····│·····│·····│·····│·····│     │
│    │  ▣ Video ▕███████ clip ████████▏                            │
│    │  ▣ Audio ▕∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿▏                                   │
└────┴───────────────────────────────────────────────────────────┘
              Made with ❤️ by Yati Bhardwaj · github.com/ys941
```

</div>

---

## ✨ Highlights

> Everything runs locally in the browser. Your media never leaves your machine.

- 🧱 **Multi-track timeline** — drag, move across tracks, trim, split, duplicate, snap & zoom
- 🖼️ **Live canvas preview** — real-time playback with on-stage drag / scale / rotate handles
- ✂️ **Crop tool** — edge cropping + one-tap aspect presets (1:1, 4:5, 9:16, 16:9, 3:4) + flip
- 🎨 **Filters & color** — 10 presets plus brightness, contrast, saturation, exposure, temperature, tint, highlights, shadows, blur, vignette, grain & hue
- 🔤 **Text** — fonts, weight, color, stroke, shadow, background pill & 8 in/out animations
- 🧩 **Overlays & stickers** — picture-in-picture videos/images with blend modes + emoji/image stickers
- 🔖 **Watermarks** — text **or** image, 9 positions, opacity, scale, rotation & tiling — burned into exports
- 🎚️ **Speed & transitions** — 0.1×–4× ramping and fade / dissolve / slide / wipe / zoom / blur / glitch / whip
- 🟢 **Chroma key** — green-screen removal with similarity, smoothness & spill controls
- 🔊 **Audio** — per-clip volume, mute & fades; per-track mute; real-time mix
- 🎞️ **Keyframes** — animate position, scale, rotation & opacity over time
- 📐 **6 aspect ratios** — 9:16, 1:1, 4:5, 16:9, 3:4, 21:9
- ⬇️ **In-browser export** — MP4 / WebM with mixed audio (and GIF via FFmpeg.wasm)
- ↩️ **Undo / redo**, snapping, and a sleek violet→cyan glass UI

---

## 🚀 Getting started

> **Requirements:** Node.js 18+ and a Chromium-based browser (for the best `MediaRecorder` / WebCodecs support).

```bash
# 1. install dependencies
npm install

# 2. start the dev server
npm run dev

# 3. open the editor
#    → http://localhost:4490
```

### Other scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server on **:4490** |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build on **:4490** |
| `npm run lint` | Run Next.js / ESLint checks |

> [!TIP]
> Don't run `npm run build` while `npm run dev` is live — they share the `.next` folder and the build can clobber the dev server's CSS chunks (page loads unstyled). If that happens: stop dev, delete `.next`, and `npm run dev` again.

> [!NOTE]
> Export uses `SharedArrayBuffer`, so the app sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers (see `next.config.mjs`). These are already configured for local dev.

---

## 🧭 A 60-second tour

1. **Import** — open the **Media** panel and drag in video, images, or audio (thumbnails are generated automatically).
2. **Build** — click a media card to drop it on the timeline. Drag to reposition, grab the edges to trim, hit **✂** to split.
3. **Style** — select a clip and visit **Crop**, **Adjust**, **Effects**, **Speed**, or **Transition**. Add **Text** and **Stickers** from their panels.
4. **Brand** — open the **Mark** panel to add a text or image **watermark** (position, opacity, tiling). It renders live and burns into the export.
5. **Export** — open **Export**, pick format/quality/resolution, and render — the file downloads straight to your machine.

---

## ✂️ Crop, in detail

The Crop panel works on any **video, image, overlay, or sticker** clip:

- **Aspect presets** — `Free`, `1:1`, `4:5`, `9:16`, `16:9`, `3:4` center-crop the clip to that ratio based on its source dimensions.
- **Edge sliders** — independently trim **Left / Right / Top / Bottom** (0–45% each).
- **Flip** — horizontal & vertical.
- Cropping re-frames the clip to **cover** the canvas; combine with Adjust's scale & position for fine framing.

Crop is part of each clip's transform, so it's keyframe-friendly and renders **identically in the preview and the export** (shared math in `src/lib/render.ts`).

---

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `S` | Split selected clip at the playhead |
| `Delete` / `Backspace` | Delete selected clip |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z` | Redo |

> Shortcuts are ignored while you're typing in an input or text box.

---

## 🛠️ Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 14** (App Router) |
| UI | **React 18** + **TypeScript** (strict) |
| Styling | **Tailwind CSS** + **Framer Motion** |
| State | **Zustand** (single source of truth) |
| Rendering | HTML5 **Canvas 2D** + `requestAnimationFrame` |
| Export | **MediaRecorder** + `canvas.captureStream()` + Web Audio mixing; **FFmpeg.wasm** for GIF |
| Icons | **lucide-react** |

---

## 🧩 Architecture

ReelStudio is built around a **single shared contract** so every subsystem stays in sync:

- **`src/types/editor.ts`** — the type contract (Clip, Track, Project, Transform, Adjustments, Watermark, …).
- **`src/store/editorStore.ts`** — the Zustand store: all state + actions (clips, tracks, keyframes, watermark, history, playback, export).
- **`src/lib/render.ts`** — pure render math shared by **preview and export**, so what you see is what you get (transforms, keyframes, filters, **crop**, chroma key, watermark layout).

```
src/
├─ app/
│  ├─ layout.tsx          # root layout + metadata
│  ├─ page.tsx            # editor shell (TopBar · ToolRail · Panel · Preview · Timeline · Footer)
│  └─ globals.css         # theme tokens, sliders, reduced-motion
├─ components/
│  ├─ shell/              # TopBar, ToolRail, Footer
│  ├─ preview/            # CanvasPlayer, useMediaPool, SelectionOverlay, TransportBar
│  ├─ timeline/           # Timeline, ruler, tracks, clip chips, playhead
│  ├─ panels/
│  │  ├─ media/  audio/  text/  overlay/
│  │  ├─ crop/            # ← Crop tool
│  │  ├─ effects/         # Effects, Adjust, Speed, Transition
│  │  └─ watermark/
│  ├─ export/             # ExportPanel
│  └─ ui/                 # shared primitives (Slider, Field, Button, …)
├─ lib/
│  ├─ render.ts           # shared render math (preview == export)
│  ├─ export/exporter.ts  # MediaRecorder + Web Audio + FFmpeg.wasm pipeline
│  ├─ constants.ts        # aspect ratios, presets, zoom levels
│  └─ utils.ts            # formatting & helpers
├─ store/editorStore.ts   # Zustand store
└─ types/editor.ts        # the type contract
```

---

## 🗺️ Roadmap

- [ ] Project **save / load** (persist across refreshes)
- [ ] **Keyframe editor UI** (the engine already exists)
- [ ] Interactive **on-canvas crop handles**
- [ ] Auto-captions / subtitles
- [ ] Audio waveform extraction from video
- [ ] Cloud export with full FFmpeg

---

## 🤝 Contributing

Issues and PRs are welcome! Please run `npm run lint` and make sure `npx tsc --noEmit` is clean before opening a pull request.

---

## 📄 License

Released under the **MIT License** — free to use, modify and share.

---

<div align="center">

### Made with ❤️ by **[Yati Bhardwaj](https://github.com/ys941)**

`github.com/ys941`

<sub>If you build something cool with ReelStudio, give the repo a ⭐</sub>

</div>
