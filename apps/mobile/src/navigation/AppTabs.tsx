import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '@todolist/ui';
import { InboxScreen }    from '../screens/InboxScreen';
import { TodayScreen }    from '../screens/TodayScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';

export type RootStackParamList = {
  InboxStack:    undefined;
  TodayStack:    undefined;
  UpcomingStack: undefined;
};

export type TaskStackParamList = {
  Inbox:      undefined;
  Today:      undefined;
  Upcoming:   undefined;
  TaskDetail: { taskId: string };
};

const Tab   = createBottomTabNavigator<RootStackParamList>();
const Stack = createNativeStackNavigator<TaskStackParamList>();

const stackScreenOptions = {
  headerShown:  false,
  contentStyle: { backgroundColor: colors.bg },
  animation:    'slide_from_right' as const,
};

const taskDetailOptions = {
  headerShown:      true,
  title:            'Task',
  headerStyle:      { backgroundColor: colors.surface },
  headerTintColor:  colors.textPrimary,
};

function InboxStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Inbox"      component={InboxScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={taskDetailOptions} />
    </Stack.Navigator>
  );
}

function TodayStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Today"      component={TodayScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={taskDetailOptions} />
    </Stack.Navigator>
  );
}

function UpcomingStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Upcoming"   component={UpcomingScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={taskDetailOptions} />
    </Stack.Navigator>
  );
}

const tabIcon = (label: string) => ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>{label}</Text>
);

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
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
    </Tab.Navigator>
  );
}
