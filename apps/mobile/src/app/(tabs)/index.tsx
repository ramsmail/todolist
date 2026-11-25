import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, Text, StyleSheet } from 'react-native';
import type { SectionListData } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAgendaTasks, useTodayStats, groupAgendaTasks, type AgendaSection } from '@todolist/db';
import { typography } from '@todolist/ui';
import { homeColors, homePriorityColor } from '../../components/home/homeTheme';
import { SwipeableTaskRow, type TaskRowData } from '../../components/SwipeableTaskRow';
import { TodayHeader } from '../../components/home/TodayHeader';
import { FAB } from '../../components/FAB';
import { QuickCaptureModal } from '../../components/QuickCaptureModal';
import { useTaskActions } from '../../hooks/useTaskActions';

// The app's landing tab. Merges what used to be three overlapping screens:
// the old Home dashboard's real widgets live in TodayHeader, and its "Top
// Priorities" list is now the Do First section — the only band a date filter
// alone could not produce.
export default function TodayScreen() {
  const { data: tasks } = useAgendaTasks();
  const { data: stats } = useTodayStats();
  const { handlePress, handleComplete, handleReschedule } = useTaskActions();
  const [capturing, setCapturing] = useState(false);

  const { completed, total } = useMemo(() => {
    const row = stats?.[0];
    return { completed: Number(row?.completed ?? 0), total: Number(row?.total ?? 0) };
  }, [stats]);

  const sections = useMemo(
    () => groupAgendaTasks(
      (tasks ?? []) as TaskRowData[],
      new Date().toISOString().split('T')[0]
    ),
    [tasks]
  );

  const renderItem = useCallback(({ item }: { item: TaskRowData }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
    />
  ), [handlePress, handleComplete, handleReschedule]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<TaskRowData, AgendaSection<TaskRowData>> }) => (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, section.key === 'overdue' && styles.sectionTitleOverdue]}>
          {section.title}
        </Text>
      </View>
    ),
    []
  );

  const keyExtractor = useCallback((item: TaskRowData) => item.id, []);

  const openCapture = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={<TodayHeader completed={completed} total={total} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing due today, and no P1 waiting.</Text>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
      />

      <FAB onPress={openCapture} />
      <QuickCaptureModal visible={capturing} onClose={closeCapture} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: homeColors.page },
  listContent: { paddingBottom: 100 },
  sectionHeader: {
    backgroundColor: homeColors.sectionBg,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTitle: {
    ...typography.caption,
    color: homeColors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionTitleOverdue: { color: homePriorityColor[1] },
  empty: {
    ...typography.body,
    color: homeColors.textMuted,
    marginTop: 40,
    textAlign: 'center',
  },
});
