import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { InboxScreen }    from '../screens/InboxScreen';
import { TodayScreen }    from '../screens/TodayScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { SearchScreen }   from '../screens/SearchScreen';
import { colors }         from '@todolist/ui';

export type AppTabsParamList = {
  Inbox:    undefined;
  Today:    undefined;
  Upcoming: undefined;
  Search:   undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

function icon(label: string) {
  const map: Record<string, string> = {
    Inbox: '📥', Today: '☀️', Upcoming: '📅', Search: '🔍',
  };
  return map[label] ?? '○';
}

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{icon(route.name)}</Text>,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
        },
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Inbox"    component={InboxScreen} />
      <Tab.Screen name="Today"    component={TodayScreen} />
      <Tab.Screen name="Upcoming" component={UpcomingScreen} />
      <Tab.Screen name="Search"   component={SearchScreen} />
    </Tab.Navigator>
  );
}
