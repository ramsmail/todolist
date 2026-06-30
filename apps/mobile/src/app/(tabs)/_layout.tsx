import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@todolist/ui';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inbox',
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 12 }}>Inbox</Text>,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 12 }}>Today</Text>,
        }}
      />
    </Tabs>
  );
}
