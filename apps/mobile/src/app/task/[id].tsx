import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTask, updateTaskTitle, updateTaskPriority, updateTaskDue,
  deleteTask, completeTask,
} from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { PriorityBadge, colors, typography } from '@todolist/ui';
import { SubTaskList } from '../../components/SubTaskList';
import { AttachmentGallery } from '../../components/AttachmentGallery';
import { DueDateField } from '../../components/DueDateField';

const PRIORITIES = [
  { value: 1, label: 'P1' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3' },
  { value: 4, label: 'P4' },
] as const;

export default function TaskDetailScreen() {
  const db = usePowerSync();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = id ?? '';

  const { data: rows } = useTask(taskId);
  const task = rows?.[0] ?? null;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const startEditTitle = useCallback(() => {
    setTitleDraft(task?.title ?? '');
    setEditingTitle(true);
  }, [task?.title]);

  const commitTitle = useCallback(async () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task?.title) {
      await updateTaskTitle(db as any, taskId, trimmed).catch(console.error);
    }
    setEditingTitle(false);
  }, [db, taskId, titleDraft, task?.title]);

  const handlePriority = useCallback(async (priority: number) => {
    await updateTaskPriority(db as any, taskId, priority).catch(console.error);
  }, [db, taskId]);

  const handleDueDate = useCallback((dueDate: string | null) => {
    updateTaskDue(db as any, taskId, dueDate, null).catch(console.error);
  }, [db, taskId]);

  const handleComplete = useCallback(async () => {
    await completeTask(db as any, taskId).catch(console.error);
    router.back();
  }, [db, taskId, router]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete task', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(db as any, taskId);
            router.back();
          } catch (e) {
            console.error(e);
            Alert.alert('Delete failed', 'Could not delete this task. Please try again.');
          }
        },
      },
    ]);
  }, [db, taskId, router]);

  if (!task) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.notFound}>Task not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Title */}
        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={commitTitle}
            autoFocus
            multiline
            returnKeyType="done"
            blurOnSubmit
          />
        ) : (
          <Pressable onPress={startEditTitle}>
            <Text style={styles.title}>{task.title}</Text>
          </Pressable>
        )}

        {/* Priority selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRIORITY</Text>
          <View style={styles.priorities}>
            {PRIORITIES.map(p => (
              <Pressable
                key={p.value}
                onPress={() => handlePriority(p.value)}
                style={[styles.priorityBtn, task.priority === p.value && styles.priorityBtnActive]}
              >
                {p.value === 4
                  ? <Text style={styles.p4Label}>P4</Text>
                  : <PriorityBadge priority={p.value as 1 | 2 | 3} />
                }
              </Pressable>
            ))}
          </View>
        </View>

        {/* Due date */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DUE DATE</Text>
          <DueDateField dueDate={task.due_date} onChange={handleDueDate} />
        </View>

        {/* Attachments */}
        <AttachmentGallery taskId={taskId} />

        {/* Sub-tasks */}
        <SubTaskList parentTaskId={taskId} projectId={task.project_id ?? null} />

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.completeBtn} onPress={handleComplete}>
            <Text style={styles.completeBtnText}>Mark complete</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete task</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  notFound: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
  title: { ...typography.heading1, color: colors.textPrimary, marginBottom: 24 },
  titleInput: { ...typography.heading1, color: colors.textPrimary, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.accent },
  section: { marginBottom: 20 },
  sectionLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  priorities: { flexDirection: 'row', gap: 8 },
  priorityBtn: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  priorityBtnActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  p4Label: { ...typography.caption, color: colors.textMuted, fontWeight: '600', paddingHorizontal: 2 },
  actions: { marginTop: 32, gap: 12 },
  completeBtn: { paddingVertical: 14, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.error, alignItems: 'center' },
  deleteBtnText: { color: colors.error, fontWeight: '500', fontSize: 15 },
});
