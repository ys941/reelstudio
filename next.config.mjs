// GITHUB_PAGES=1 switches to a static export served from /reelstudio (the live
// demo). Local dev and self-hosting are unaffected.
const isPages = process.env.GITHUB_PAGES === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Required so instrumentation.ts (the attribution gate) runs on boot in Next 14.
  experimental: { instrumentationHook: true },
  ...(isPages
    ? {
        output: 'export',
        basePath: '/reelstudio',
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        // Required headers so ffmpeg.wasm (SharedArrayBuffer) works in the browser.
        async headers() {
          return [
            {
              source: '/(.*)',
              headers: [
                { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
              ],
            },
          ];
        },
      }),
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
};

export default nextConfig;
