import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTask, updateTaskTitle, updateTaskDescription, updateTaskPriority, updateTaskDue,
  setTaskLabels, deleteTask, completeTask, useLabels,
} from '@todolist/db';
import { parseLabelsJson } from '@todolist/core';
import { usePowerSync } from '@powersync/react';
import { PriorityBadge, colors, typography } from '@todolist/ui';
import { SubTaskList } from '../../components/SubTaskList';
import { AttachmentGallery } from '../../components/AttachmentGallery';
import { DueDateField } from '../../components/DueDateField';
import { LinkifiedText } from '../../components/LinkifiedText';
import { LabelChip } from '../../components/LabelChip';
import { LabelPickerSheet } from '../../components/LabelPickerSheet';

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
  const { data: allLabels } = useLabels();

  const [labelPickerVisible, setLabelPickerVisible] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  // Defaults to true: opening a task should drop you straight into the description
  // field with the keyboard already up, instead of requiring a tap first.
  const [editingDescription, setEditingDescription] = useState(true);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  useEffect(() => {
    if (task) setDescriptionDraft(task.description ?? '');
  }, [task?.id, task?.description]);

  // Autosave rather than relying solely on TextInput's onBlur — navigating away
  // (header back arrow, hardware back, swipe gesture) doesn't reliably fire
  // blur before the screen unmounts, which silently dropped edits.
  useEffect(() => {
    if (!editingTitle || !task) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === task.title) return;
    const timer = setTimeout(() => {
      updateTaskTitle(db as any, taskId, trimmed).catch(console.error);
    }, 600);
    return () => clearTimeout(timer);
  }, [db, taskId, titleDraft, editingTitle, task?.title]);

  useEffect(() => {
    if (!editingDescription || !task) return;
    if (descriptionDraft === (task.description ?? '')) return;
    const timer = setTimeout(() => {
      updateTaskDescription(db as any, taskId, descriptionDraft || null).catch(console.error);
    }, 600);
    return () => clearTimeout(timer);
  }, [db, taskId, descriptionDraft, editingDescription, task?.description]);

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

  const startEditDescription = useCallback(() => {
    setDescriptionDraft(task?.description ?? '');
    setEditingDescription(true);
  }, [task?.description]);

  const commitDescription = useCallback(async () => {
    if (descriptionDraft !== (task?.description ?? '')) {
      await updateTaskDescription(db as any, taskId, descriptionDraft || null).catch(console.error);
    }
    setEditingDescription(false);
  }, [db, taskId, descriptionDraft, task?.description]);

  const handleLabels = useCallback(async (labels: string[]) => {
    await setTaskLabels(db as any, taskId, labels).catch(console.error);
  }, [db, taskId]);

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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            <LinkifiedText text={task.title} style={styles.title} />
          </Pressable>
        )}

        {/* Description */}
        {editingDescription ? (
          <TextInput
            style={styles.descriptionInput}
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            onBlur={commitDescription}
            autoFocus
            multiline
            placeholder="Add description"
            placeholderTextColor={colors.textMuted}
          />
        ) : (
          <Pressable onPress={startEditDescription} style={styles.section}>
            {task.description ? (
              <LinkifiedText text={task.description} style={styles.description} />
            ) : (
              <Text style={styles.descriptionPlaceholder}>Add description</Text>
            )}
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

        {/* Labels */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LABELS</Text>
          <Pressable style={styles.labelsRow} onPress={() => setLabelPickerVisible(true)}>
            {parseLabelsJson(task.labels).length > 0 ? (
              <View style={styles.labelChips}>
                {parseLabelsJson(task.labels).map(name => (
                  <LabelChip key={name} name={name} color={allLabels.find(l => l.name === name)?.color ?? colors.accent} />
                ))}
              </View>
            ) : (
              <Text style={styles.labelsPlaceholder}>Add labels</Text>
            )}
          </Pressable>
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
      </KeyboardAvoidingView>

      <LabelPickerSheet
        visible={labelPickerVisible}
        selected={parseLabelsJson(task.labels)}
        onChange={handleLabels}
        onClose={() => setLabelPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  notFound: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
  title: { ...typography.heading1, color: colors.textPrimary, marginBottom: 24 },
  titleInput: { ...typography.heading1, color: colors.textPrimary, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.accent },
  description: { ...typography.body, color: colors.textPrimary },
  descriptionPlaceholder: { ...typography.body, color: colors.textMuted },
  descriptionInput: { ...typography.body, color: colors.textPrimary, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.accent, minHeight: 60, textAlignVertical: 'top' },
  section: { marginBottom: 20 },
  labelsRow: { minHeight: 24, justifyContent: 'center' },
  labelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  labelsPlaceholder: { ...typography.body, color: colors.textMuted },
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
