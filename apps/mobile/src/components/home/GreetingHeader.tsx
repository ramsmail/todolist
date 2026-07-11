import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { homeColors } from './homeTheme';

function partOfDay(hour: number): string {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function displayName(session: ReturnType<typeof useAuth>['session']): string {
  const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const full = meta?.full_name ?? meta?.name;
  if (full && full.trim()) return full.trim().split(' ')[0];
  const email = session?.user?.email;
  if (email) {
    const local = email.split('@')[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return 'there';
}

export function GreetingHeader() {
  const { session } = useAuth();
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <Text style={styles.date}>{dateStr}</Text>
      <Text style={styles.greeting}>
        Good {partOfDay(now.getHours())}, {displayName(session)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  date: { fontSize: 13, color: homeColors.textSecondary, fontWeight: '500' },
  greeting: { fontSize: 26, color: homeColors.textPrimary, fontWeight: '700', letterSpacing: -0.5 },
});
