import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useProjectTasks, completeTask, updateTaskDue } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../components/SwipeableTaskRow';
import { FAB }               from '../components/FAB';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import type { AppDrawerParamList } from '../navigation/AppDrawer';

type RouteProps = RouteProp<AppDrawerParamList, 'Project'>;

export function ProjectScreen() {
  const db    = usePowerSync();
  const route = useRoute<RouteProps>();
  const { id: projectId, name } = route.params;

  const { data: tasks } = useProjectTasks(projectId);
  const [capturing, setCapturing] = useState(false);

  const handleComplete   = useCallback((id: string) => {
    completeTask(db as any, id).catch(console.error);
  }, [db]);

  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
  }, [db]);

  // ProjectScreen has no navigation to TaskDetail (drawer navigator, not stack)
  // Tapping a task is a no-op for now; Task 6 handles detail via tab stacks
  const handlePress = useCallback((_id: string) => {}, []);

  const renderItem   = useCallback(({ item }: { item: TaskRowData }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
    />
  ), [handlePress, handleComplete, handleReschedule]);

  const keyExtractor = useCallback((item: TaskRowData) => item.id, []);

  const openCapture  = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.count}>{tasks?.length ?? 0}</Text>
      </View>

      <FlatList
        data={tasks ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={tasks?.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={styles.empty}>No tasks in this project.</Text>
        }
      />

      <FAB onPress={openCapture} />

      <QuickCaptureModal
        visible={capturing}
        projectId={projectId}
        onClose={closeCapture}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:          { ...typography.heading1, color: colors.textPrimary, flex: 1 },
  count:          { ...typography.caption, color: colors.textMuted, fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:          { ...typography.body, color: colors.textMuted, marginTop: 80, textAlign: 'center' },
});
