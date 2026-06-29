import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth }    from '../auth/AuthContext';
import { AuthStack }  from './AuthStack';
import { AppDrawer }  from './AppDrawer';
import { AppTabs }    from './AppTabs';
import { colors }     from '@todolist/ui';

// THROWAWAY (foundation sanity-test only): bypass the reanimated-4-incompatible
// drawer and render the bottom-tabs directly so we can reach the task list and
// verify PowerSync sync. Reverted in the router migration. Keep AppDrawer import
// so eslint/ts don't complain while it's temporarily unused.
void AppDrawer;

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      {session ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
