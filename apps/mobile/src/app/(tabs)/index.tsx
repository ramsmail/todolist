import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMatrixTasks, useProjects, completeTask, updateTaskDue, updateTaskPriority } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../../components/SwipeableTaskRow';
import { QuadrantTabs } from '../../components/QuadrantTabs';
import { QuadrantPickerSheet } from '../../components/QuadrantPickerSheet';
import { FAB } from '../../components/FAB';
import { QuickCaptureModal } from '../../components/QuickCaptureModal';

const EMPTY_COPY: Record<1 | 2 | 3 | 4, string> = {
  1: 'Nothing urgent right now.',
  2: 'Nothing to plan yet.',
  3: 'Nothing to pass along.',
  4: 'Nothing to drop 🎉',
};

type MatrixTask = TaskRowData & { project_id: string | null };

export default function TasksScreen() {
  const db = usePowerSync();
  const router = useRouter();
  const { byQuadrant } = useMatrixTasks();
  const { data: projects } = useProjects();
  const [active, setActive] = useState<1 | 2 | 3 | 4>(1);
  const [capturing, setCapturing] = useState(false);
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects ?? []) {
      if (project.name) map.set(project.id, project.name);
    }
    return map;
  }, [projects]);

  const tasks = (byQuadrant[active] ?? []) as MatrixTask[];

  const handlePress = useCallback((id: string) => router.push(`/task/${id}`), [router]);

  const handleComplete = useCallback((id: string) => {
    completeTask(db as any, id).catch(console.error);
  }, [db]);

  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
  }, [db]);

  const handlePriorityPress = useCallback((id: string) => setReassigningId(id), []);

  const closeReassign = useCallback(() => setReassigningId(null), []);

  const handleReassign = useCallback((quadrant: 1 | 2 | 3 | 4) => {
    if (!reassigningId) return;
    updateTaskPriority(db as any, reassigningId, quadrant).catch(console.error);
  }, [db, reassigningId]);

  const renderItem = useCallback(({ item }: { item: MatrixTask }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
      onPriorityPress={handlePriorityPress}
      projectName={item.project_id ? projectNameById.get(item.project_id) : null}
    />
  ), [handlePress, handleComplete, handleReschedule, handlePriorityPress, projectNameById]);

  const keyExtractor = useCallback((item: MatrixTask) => item.id, []);

  const openCapture = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.count}>{tasks.length}</Text>
      </View>

      <QuadrantTabs active={active} onChange={setActive} />

      <FlatList
        data={tasks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={styles.empty}>{EMPTY_COPY[active]}</Text>
        }
      />

      <FAB onPress={openCapture} />

      <QuickCaptureModal visible={capturing} onClose={closeCapture} defaultPriority={active} />

      <QuadrantPickerSheet
        visible={reassigningId !== null}
        onSelect={handleReassign}
        onClose={closeReassign}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { ...typography.heading1, color: colors.textPrimary, flex: 1 },
  count: { ...typography.caption, color: colors.textMuted, fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { ...typography.body, color: colors.textMuted, marginTop: 80, textAlign: 'center' },
});
