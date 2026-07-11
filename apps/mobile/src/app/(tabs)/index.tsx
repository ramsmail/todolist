import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react';
import { useTopPriorities, useTodayStats, completeTask } from '@todolist/db';
import { FAB } from '../../components/FAB';
import { QuickCaptureModal } from '../../components/QuickCaptureModal';
import { GreetingHeader } from '../../components/home/GreetingHeader';
import { DailyFocusCard } from '../../components/home/DailyFocusCard';
import { EnergySelector } from '../../components/home/EnergySelector';
import { HomePriorityRow, type PriorityRowData } from '../../components/home/HomePriorityRow';
import { StatCard } from '../../components/home/StatCard';
import { StartFocusButton } from '../../components/home/StartFocusButton';
import { homeColors, homeSpace, homePriorityColor } from '../../components/home/homeTheme';

const DAILY_FOCUS = 'Focus on what moves the needle today.';

export default function HomeScreen() {
  const db = usePowerSync();
  const router = useRouter();
  const { data: priorities } = useTopPriorities();
  const { data: stats } = useTodayStats();
  const [capturing, setCapturing] = useState(false);

  const { completed, total } = useMemo(() => {
    const row = stats?.[0];
    return { completed: Number(row?.completed ?? 0), total: Number(row?.total ?? 0) };
  }, [stats]);

  const handlePress = useCallback((id: string) => router.push(`/task/${id}`), [router]);
  const handleComplete = useCallback((id: string) => {
    completeTask(db as any, id).catch(console.error);
  }, [db]);

  const openCapture = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GreetingHeader />
        <DailyFocusCard statement={DAILY_FOCUS} />
        <EnergySelector />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Priorities</Text>
          <Text style={styles.sectionHint}>Swipe left to complete</Text>
        </View>

        {priorities && priorities.length > 0 ? (
          priorities.map((task) => (
            <HomePriorityRow
              key={task.id}
              task={task as PriorityRowData}
              onPress={handlePress}
              onComplete={handleComplete}
            />
          ))
        ) : (
          <Text style={styles.empty}>No priorities yet — add a task to get started.</Text>
        )}

        <View style={styles.statsRow}>
          <StatCard
            label="Tasks"
            value={`${completed}/${total}`}
            progress={total > 0 ? completed / total : 0}
            color={homePriorityColor[4]}
          />
          <StatCard label="Focus" value="0m/2h" progress={0} color={homeColors.accent} />
          <StatCard label="Habits" value="4/5" progress={0.8} color={homeColors.energy} />
        </View>

        <StartFocusButton />
      </ScrollView>

      <FAB onPress={openCapture} />
      <QuickCaptureModal visible={capturing} onClose={closeCapture} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: homeColors.page },
  content: {
    padding: homeSpace.screen,
    paddingBottom: 100,
    gap: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -8,
  },
  sectionTitle: { fontSize: 17, color: homeColors.textPrimary, fontWeight: '700' },
  sectionHint: { fontSize: 12, color: homeColors.textMuted },
  statsRow: { flexDirection: 'row', gap: homeSpace.gap },
  empty: { fontSize: 14, color: homeColors.textMuted, paddingVertical: 8 },
});
