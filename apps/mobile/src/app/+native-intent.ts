import { getShareExtensionKey } from 'expo-share-intent';

/**
 * Expo Router calls this for incoming deep links — including a cold start
 * launched from the Android share sheet — before the app mounts. When the path
 * carries the share-extension payload key, route straight to the capture screen.
 * Warm-start shares (app already running) are handled by the navigation effect
 * in _layout.tsx via useShareIntentContext().
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/share';
    }
  } catch {
    // Never let a redirect error swallow a normal deep link.
  }
  return path;
}
