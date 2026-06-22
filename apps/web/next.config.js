/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @powersync/web and wa-sqlite are browser-only (WASM/Web Workers).
    // Excluding them from the RSC server bundle prevents __dirname errors
    // and avoids loading WASM/Worker code in a Node.js SSR context.
    // NOTE: @supabase/supabase-js must NOT be listed here — marking it external
    // causes webpack to emit `e.exports=import("@supabase/supabase-js")` (a
    // Promise) in server bundles, breaking SSR prerendering with "Element type
    // is invalid: got undefined". Instead, webpack bundles it and DefinePlugin
    // below replaces __dirname with "/" in its ncc-compiled sub-packages.
    serverComponentsExternalPackages: [
      '@powersync/web',
      '@journeyapps/wa-sqlite',
    ],
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
    // @supabase/supabase-js bundles ncc-compiled packages (cookie, ua-parser-js,
    // @opentelemetry) that contain `n.ab = __dirname + "/"` in their own webpack
    // mini-runtimes. These crash on Edge Runtime where __dirname is undefined.
    // DefinePlugin replaces __dirname with "/" in all webpack-processed code,
    // eliminating the crash without needing to mark the package as external.
    config.plugins.push(
      new webpack.DefinePlugin({
        __dirname: JSON.stringify('/'),
      })
    );
    return config;
  },
};

module.exports = nextConfig;
