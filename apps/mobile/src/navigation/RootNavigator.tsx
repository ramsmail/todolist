import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth }    from '../auth/AuthContext';
import { AuthStack }  from './AuthStack';
import { AppDrawer }  from './AppDrawer';
import { colors }     from '@todolist/ui';

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
      {session ? <AppDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
}
