import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInboxTasks, completeTask, updateTaskDue } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../components/SwipeableTaskRow';
import { FAB }               from '../components/FAB';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import type { TaskStackParamList } from '../navigation/AppTabs';

type Nav = NativeStackNavigationProp<TaskStackParamList, 'Inbox'>;

export function InboxScreen() {
  const db         = usePowerSync();
  const nav        = useNavigation<Nav>();
  const { data: tasks } = useInboxTasks();
  const [capturing, setCapturing] = useState(false);

  const handlePress = useCallback((id: string) => nav.navigate('TaskDetail', { taskId: id }), [nav]);

  const handleComplete = useCallback((id: string) => {
    completeTask(db as any, id).catch(console.error);
  }, [db]);

  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0]).catch(console.error);
  }, [db]);

  const renderItem = useCallback(({ item }: { item: TaskRowData }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
    />
  ), [handlePress, handleComplete, handleReschedule]);

  const keyExtractor = useCallback((item: TaskRowData) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.count}>{tasks?.length ?? 0}</Text>
      </View>

      <FlatList
        data={tasks ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={tasks?.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={styles.empty}>All clear! Add a task below.</Text>
        }
      />

      <FAB onPress={() => setCapturing(true)} />

      <QuickCaptureModal
        visible={capturing}
        onClose={() => setCapturing(false)}
      />
    </View>
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
