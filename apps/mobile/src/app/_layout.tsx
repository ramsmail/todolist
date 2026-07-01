import '../polyfills';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { PowerSyncProvider } from '../powersync/PowerSyncProvider';
import { useOfflineAttachmentSync } from '../hooks/useOfflineAttachmentSync';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const { hasShareIntent } = useShareIntentContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)' || segments[0] === 'login';
    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  useOfflineAttachmentSync();

  // Warm start: app already running when a share arrives. Cold starts are routed
  // by app/+native-intent.ts. Only capture once authenticated; otherwise the auth
  // gate above sends the user to /login first.
  useEffect(() => {
    if (hasShareIntent && session) {
      router.push('/share');
    }
  }, [hasShareIntent, session, router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider options={{ debug: __DEV__, resetOnBackground: true }}>
        <SafeAreaProvider>
          <AuthProvider>
            <PowerSyncProvider>
              <RootLayoutNav />
            </PowerSyncProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
