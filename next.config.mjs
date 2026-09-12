/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Required so instrumentation.ts (the attribution gate) runs on boot in Next 14.
  experimental: { instrumentationHook: true },
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
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
};

export default nextConfig;
