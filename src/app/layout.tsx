import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReelStudio — Video Editor',
  description: 'A full-featured web video editor with overlays, effects and watermarks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
