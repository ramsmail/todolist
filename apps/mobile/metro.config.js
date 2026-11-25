const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole workspace, not just packages/*. This is what lets
// Metro follow pnpm's symlinks into the root node_modules/.pnpm store where the
// real dependency files live (e.g. react-native-css-interop's jsx-runtime).
config.watchFolders = [monorepoRoot];

// Resolve modules from the app first, then the monorepo root (pnpm hoists the
// content-addressable store under the root node_modules).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force singleton packages to always resolve from apps/mobile/node_modules.
//
// WHY resolveRequest instead of extraNodeModules:
//   extraNodeModules is a FALLBACK — Metro only checks it when the module is not
//   found via normal directory-walking. Because pnpm creates a real symlink at
//   packages/db/node_modules/@powersync/react (pointing to the react@18 variant),
//   Metro finds it there first and never reaches extraNodeModules. The result is
//   two PowerSyncContext objects (react@18 vs react@19), so usePowerSync() in
//   packages/db queries returns null → "PowerSync not configured." → blank Inbox.
//
// WHY before withNativeWind:
//   withNativeWind wraps resolveRequest and stores ours as `originalResolver`,
//   calling it for every non-CSS module. So our override is always in the chain.
const singletonModules = ['react', 'react-dom', '@powersync/react'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonModules.includes(moduleName)) {
    // require.resolve starts from projectRoot, so it finds apps/mobile/node_modules/<pkg>
    // (the react@19 / @powersync+react_react@19.2.3 variants) regardless of which
    // workspace package contains the importing file.
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Since we now watch the whole monorepo, exclude heavy/irrelevant trees from
// Metro's crawl so it doesn't exhaust inotify watchers: git worktrees (each has
// its own full node_modules) and native build output.
const blockExtras = [
  /[/\\]\.worktrees[/\\].*/,
  /[/\\]android[/\\](build|app[/\\]build|\.cxx)[/\\].*/,
  /[/\\]ios[/\\](build|Pods)[/\\].*/,
];
const existingBlock = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existingBlock)
  ? [...existingBlock, ...blockExtras]
  : existingBlock
    ? [existingBlock, ...blockExtras]
    : blockExtras;

module.exports = withNativeWind(config, { input: './src/global.css' });
