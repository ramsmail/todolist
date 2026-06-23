import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInboxTasks, completeTask, updateTaskDue } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../components/SwipeableTaskRow';
import { FAB }               from '../components/FAB';
import { QuickCaptureModal } from '../components/QuickCaptureModal';
import type { InboxStackParamList } from '../navigation/AppTabs';

type Nav = NativeStackNavigationProp<InboxStackParamList, 'Inbox'>;

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
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
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

  const openCapture  = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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

      <FAB onPress={openCapture} />

      <QuickCaptureModal visible={capturing} onClose={closeCapture} />
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
