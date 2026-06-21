import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTodayTasks, completeTask, updateTaskDue } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../components/SwipeableTaskRow';
import { FAB }               from '../components/FAB';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import type { TodayStackParamList } from '../navigation/AppTabs';

type Nav = NativeStackNavigationProp<TodayStackParamList, 'Today'>;

interface Section {
  title:   string;
  data:    TaskRowData[];
  overdue: boolean;
}

export function TodayScreen() {
  const db         = usePowerSync();
  const nav        = useNavigation<Nav>();
  const { data: tasks } = useTodayTasks();
  const [capturing, setCapturing] = useState(false);

  const sections = useMemo((): Section[] => {
    const today   = new Date().toISOString().split('T')[0];
    const overdue = (tasks ?? []).filter(t => t.due_date && t.due_date < today);
    const dueToday = (tasks ?? []).filter(t => t.due_date === today);
    return [
      ...(overdue.length  ? [{ title: 'Overdue', data: overdue,   overdue: true  }] : []),
      ...(dueToday.length ? [{ title: 'Today',   data: dueToday,  overdue: false }] : []),
    ];
  }, [tasks]);

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
      <Text style={[styles.sectionTitle, section.overdue && styles.sectionTitleOverdue]}>
        {section.title}
      </Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item: TaskRowData) => item.id, []);

  const openCapture  = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.count}>{tasks?.length ?? 0}</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>Nothing due today.</Text>}
        stickySectionHeadersEnabled
      />

      <FAB onPress={openCapture} />

      <QuickCaptureModal visible={capturing} onClose={closeCapture} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.bg },
  header:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:               { ...typography.heading1, color: colors.textPrimary, flex: 1 },
  count:               { ...typography.caption, color: colors.textMuted, fontSize: 14 },
  sectionHeader:       { backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, paddingVertical: 6 },
  sectionTitle:        { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  sectionTitleOverdue: { color: colors.p1 },
  emptyContainer:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:               { ...typography.body, color: colors.textMuted, marginTop: 80, textAlign: 'center' },
});
