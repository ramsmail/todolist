import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider }       from 'react-native-safe-area-context';
import { AuthProvider }           from './auth/AuthContext';
import { PowerSyncProvider }      from './powersync/PowerSyncProvider';
import { RootNavigator }          from './navigation/RootNavigator';

export function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PowerSyncProvider>
            <RootNavigator />
          </PowerSyncProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
