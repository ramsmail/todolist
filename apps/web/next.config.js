/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @powersync/web and wa-sqlite are browser-only (WASM/Web Workers).
    // Excluding them from the RSC server bundle prevents __dirname errors.
    serverComponentsExternalPackages: [
      '@powersync/web',
      '@journeyapps/wa-sqlite',
      // @supabase/supabase-js is bundled by webpack it transitively pulls in
      // ncc-compiled packages (cookie, ua-parser-js, @opentelemetry) that ship
      // their own webpack mini-runtimes containing `n.ab = __dirname + "/"`.
      // Marking it external tells webpack to require() it from node_modules at
      // runtime (CJS context) where __dirname is always defined by Node.js.
      '@supabase/supabase-js',
    ],
    // Allow instrumentation.ts to run (Next.js 14.1+ auto-detects it, but flag
    // is kept as documentation that the file is intentional).
    instrumentationHook: true,
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
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    // Some bundled packages (via their own webpack mini-runtime) reference __dirname.
    // In Vercel's server environment this variable is not always available, so inject it.
    config.plugins.push(
      new webpack.DefinePlugin({
        __dirname: JSON.stringify('/'),
      })
    );
    return config;
  },
};

module.exports = nextConfig;
