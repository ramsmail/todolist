import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUpcomingTasks, completeTask, updateTaskDue } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../components/SwipeableTaskRow';
import { FAB }               from '../components/FAB';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import type { UpcomingStackParamList } from '../navigation/AppTabs';

type Nav = NativeStackNavigationProp<UpcomingStackParamList, 'Upcoming'>;

interface Section {
  title: string;
  data:  TaskRowData[];
}

function groupByDate(tasks: TaskRowData[]): Section[] {
  const map = new Map<string, TaskRowData[]>();
  for (const task of tasks) {
    const key = task.due_date ?? 'No date';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(task);
  }
  // Sort sections chronologically; 'No date' sorts last via localeCompare
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

export function UpcomingScreen() {
  const db         = usePowerSync();
  const nav        = useNavigation<Nav>();
  const { data: tasks } = useUpcomingTasks();
  const [capturing, setCapturing] = useState(false);

  const sections = useMemo(() => groupByDate(tasks ?? []), [tasks]);

  const handlePress      = useCallback((id: string) => nav.navigate('TaskDetail', { taskId: id }), [nav]);
  const handleComplete   = useCallback((id: string) => { completeTask(db as any, id).catch(console.error); }, [db]);
  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
  }, [db]);

  const renderItem = useCallback(({ item }: { item: TaskRowData }) => (
    <SwipeableTaskRow task={item} onPress={handlePress} onComplete={handleComplete} onReschedule={handleReschedule} />
  ), [handlePress, handleComplete, handleReschedule]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item: TaskRowData) => item.id, []);

  const openCapture  = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming tasks.</Text>}
        stickySectionHeadersEnabled
      />

      <FAB onPress={openCapture} />

      <QuickCaptureModal visible={capturing} onClose={closeCapture} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg },
  header:        { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:         { ...typography.heading1, color: colors.textPrimary },
  sectionHeader: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle:  { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:         { ...typography.body, color: colors.textMuted, marginTop: 80, textAlign: 'center' },
});
