import { Tabs } from 'expo-router';
import { Home, LayoutGrid, CheckSquare } from 'lucide-react-native';
import { homeColors } from '../../components/home/homeTheme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: homeColors.accent,
        tabBarInactiveTintColor: homeColors.textMuted,
        tabBarStyle: {
          backgroundColor: homeColors.card,
          borderTopColor: homeColors.cardBorder,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
