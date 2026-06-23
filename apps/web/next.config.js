/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @powersync/web and wa-sqlite are browser-only (WASM/Web Workers).
    // Keep them out of the RSC server bundle so WASM/Worker code never loads
    // in a Node.js SSR context.
    serverComponentsExternalPackages: [
      '@powersync/web',
      '@journeyapps/wa-sqlite',
    ],
  },
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
