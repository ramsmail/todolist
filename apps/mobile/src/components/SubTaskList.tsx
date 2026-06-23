import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert,
} from 'react-native';
import { usePowerSync } from '@powersync/react';
import { useSubtasks, createTask, completeTask } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { TaskCheckbox, colors, typography } from '@todolist/ui';

interface Props {
  parentTaskId: string;
  projectId:    string | null;
}

interface SubTaskRow {
  id:     string;
  title:  string;
  status: string;
}

export function SubTaskList({ parentTaskId, projectId }: Props) {
  const db          = usePowerSync();
  const { session } = useAuth();
  const { data: subtasks } = useSubtasks(parentTaskId);
  const [adding, setAdding]   = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleComplete = useCallback((id: string) => {
    completeTask(db as any, id).catch(console.error);
  }, [db]);

  const handleAdd = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !session) return;
    try {
      await createTask(db as any, {
        userId:       session.user.id,
        title:        trimmed,
        priority:     4,
        status:       'active',
        projectId:    projectId ?? null,
        parentTaskId: parentTaskId,
      });
      setNewTitle('');
      setAdding(false);
    } catch (e) {
      console.error('createTask (subtask) failed:', e);
      Alert.alert('Could not add sub-task', 'Please try again.');
    }
  }, [db, session, newTitle, projectId, parentTaskId]);

  const renderItem = useCallback(({ item }: { item: SubTaskRow }) => (
    <View style={styles.row}>
      <TaskCheckbox
        priority={4}
        checked={item.status === 'done'}
        onComplete={() => handleComplete(item.id)}
      />
      <Text
        style={[styles.title, item.status === 'done' && styles.titleDone]}
        numberOfLines={1}
      >
        {item.title}
      </Text>
    </View>
  ), [handleComplete]);

  const keyExtractor = useCallback((item: SubTaskRow) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Sub-tasks</Text>
        {!adding && (
          <Pressable onPress={() => setAdding(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={subtasks ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
      />

      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Sub-task name…"
            placeholderTextColor={colors.textMuted}
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            blurOnSubmit={false}
          />
          <Pressable style={styles.saveBtn} onPress={handleAdd}>
            <Text style={styles.saveBtnText}>Add</Text>
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => { setAdding(false); setNewTitle(''); }}
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelBtnText}>✕</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { marginTop: 24 },
  header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  heading:      { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.6, flex: 1 },
  addBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface },
  addBtnText:   { color: colors.accent, fontWeight: '600', fontSize: 13 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  title:        { ...typography.body, color: colors.textPrimary, flex: 1 },
  titleDone:    { color: colors.textMuted, textDecorationLine: 'line-through' },
  addRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  addInput:     {
    flex: 1, ...typography.body, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 8, borderWidth: 1, borderColor: colors.border,
  },
  saveBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.accent },
  saveBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
  cancelBtn:    { paddingHorizontal: 10, paddingVertical: 8 },
  cancelBtnText: { color: colors.textMuted, fontSize: 16 },
});
