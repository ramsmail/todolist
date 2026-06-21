import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import { colors, SyncStatusIndicator } from '@todolist/ui';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { InboxScreen }    from '../screens/InboxScreen';
import { TodayScreen }    from '../screens/TodayScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { SearchScreen }   from '../screens/SearchScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';

export type RootStackParamList = {
  InboxStack:    undefined;
  TodayStack:    undefined;
  UpcomingStack: undefined;
  SearchStack:   undefined;
};

// Per-stack param lists — each stack only exposes its own root + TaskDetail
export type InboxStackParamList    = { Inbox: undefined;    TaskDetail: { taskId: string } };
export type TodayStackParamList    = { Today: undefined;    TaskDetail: { taskId: string } };
export type UpcomingStackParamList = { Upcoming: undefined; TaskDetail: { taskId: string } };
export type SearchStackParamList   = { Search: undefined };

const Tab            = createBottomTabNavigator<RootStackParamList>();
const InboxStackNav  = createNativeStackNavigator<InboxStackParamList>();
const TodayStackNav  = createNativeStackNavigator<TodayStackParamList>();
const UpcomingStackNav = createNativeStackNavigator<UpcomingStackParamList>();
const SearchStackNav = createNativeStackNavigator<SearchStackParamList>();

const stackScreenOptions = {
  headerShown:  false,
  contentStyle: { backgroundColor: colors.bg },
  animation:    'slide_from_right' as const,
};

const taskDetailOptions = {
  headerShown:     true,
  title:           'Task',
  headerStyle:     { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
};

function InboxStack() {
  return (
    <InboxStackNav.Navigator screenOptions={stackScreenOptions}>
      <InboxStackNav.Screen name="Inbox"      component={InboxScreen} />
      <InboxStackNav.Screen name="TaskDetail" component={TaskDetailScreen} options={taskDetailOptions} />
    </InboxStackNav.Navigator>
  );
}

function TodayStack() {
  return (
    <TodayStackNav.Navigator screenOptions={stackScreenOptions}>
      <TodayStackNav.Screen name="Today"      component={TodayScreen} />
      <TodayStackNav.Screen name="TaskDetail" component={TaskDetailScreen} options={taskDetailOptions} />
    </TodayStackNav.Navigator>
  );
}

function UpcomingStack() {
  return (
    <UpcomingStackNav.Navigator screenOptions={stackScreenOptions}>
      <UpcomingStackNav.Screen name="Upcoming"   component={UpcomingScreen} />
      <UpcomingStackNav.Screen name="TaskDetail" component={TaskDetailScreen} options={taskDetailOptions} />
    </UpcomingStackNav.Navigator>
  );
}

function SearchStack() {
  return (
    <SearchStackNav.Navigator screenOptions={stackScreenOptions}>
      <SearchStackNav.Screen name="Search" component={SearchScreen} />
    </SearchStackNav.Navigator>
  );
}

const tabIcon = (label: string) => ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>{label}</Text>
);

export function AppTabs() {
  const { status, lastSyncedAt } = useSyncStatus();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor:   colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        <Tab.Screen
          name="InboxStack"
          component={InboxStack}
          options={{ title: 'Inbox', tabBarIcon: tabIcon('📥') }}
        />
        <Tab.Screen
          name="TodayStack"
          component={TodayStack}
          options={{ title: 'Today', tabBarIcon: tabIcon('☀️') }}
        />
        <Tab.Screen
          name="UpcomingStack"
          component={UpcomingStack}
          options={{ title: 'Upcoming', tabBarIcon: tabIcon('📅') }}
        />
        <Tab.Screen
          name="SearchStack"
          component={SearchStack}
          options={{ title: 'Search', tabBarIcon: tabIcon('🔍') }}
        />
      </Tab.Navigator>
      <View style={{ position: 'absolute', top: 8, right: 16, zIndex: 100 }}>
        <SyncStatusIndicator status={status} lastSyncedAt={lastSyncedAt} />
      </View>
    </View>
  );
}
