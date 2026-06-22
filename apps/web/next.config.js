/** @type {import('next').NextConfig} */
const nextConfig = {
  // @powersync/web and wa-sqlite are browser-only (WASM/Web Workers).
  // Excluding them from the server bundle prevents __dirname errors in the ESM server context.
  serverExternalPackages: ['@powersync/web', '@journeyapps/wa-sqlite'],
  transpilePackages: [
    '@todolist/core',
    '@todolist/db',
    '@powersync/react',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },
};

module.exports = nextConfig;
