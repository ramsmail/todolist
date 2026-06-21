import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal, View, TextInput, Pressable, Text, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { usePowerSync } from '@powersync/react';
import { parseTaskInput } from '@todolist/core';
import { createTask }    from '@todolist/db';
import { useAuth }       from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';

interface Props {
  visible:   boolean;
  projectId?: string | null;
  onClose:   () => void;
}

export function QuickCaptureModal({ visible, projectId, onClose }: Props) {
  const db              = usePowerSync();
  const { session }     = useAuth();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Stable ref so onClose is never a useCallback dependency (avoids churn)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !session) return;

    setError(null);
    setSaving(true);
    let succeeded = false;
    try {
      const parsed = parseTaskInput(trimmed, { now: new Date() });
      // Note: parsed.projectSlug (#tag) is not yet resolved to an ID — projectId prop takes precedence
      await createTask(db as any, {
        userId:    session.user.id,
        title:     parsed.title,
        priority:  parsed.priority,
        dueDate:   parsed.dueDate,
        dueTime:   parsed.dueTime,
        timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId: projectId ?? null,
        labels:    parsed.labels,
        status:    'inbox',
      });
      succeeded = true;
    } catch (e) {
      console.error('createTask failed:', e);
      setError('Could not save task. Please try again.');
    } finally {
      setSaving(false);
    }
    // Call onClose after finally so setSaving(false) runs on the mounted component
    if (succeeded) {
      setInput('');
      onCloseRef.current();
    }
  }, [db, input, session, projectId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCloseRef.current}
    >
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.handle} />

        <Text style={styles.heading}>New task</Text>
        <Text style={styles.hint}>
          Tip: "Buy milk p1 @waiting tomorrow 3pm"
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="What needs to be done?"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={text => { setError(null); setInput(text); }}
          autoFocus
          // multiline + onSubmitEditing is unreliable on Android; rely on "Add task" button
          multiline={Platform.OS === 'ios'}
          returnKeyType={Platform.OS === 'ios' ? 'done' : 'default'}
          blurOnSubmit={Platform.OS === 'ios'}
          onSubmitEditing={Platform.OS === 'ios' ? handleSave : undefined}
          testID="quick-capture-input"
        />

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCloseRef.current}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[styles.saveBtn, !input.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!input.trim() || saving}
            testID="quick-capture-save"
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveText}>Add task</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  heading: { ...typography.heading2, color: colors.textPrimary, marginBottom: 4 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: 16 },
  errorText: { ...typography.caption, color: colors.error, marginBottom: 12 },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: '500', fontSize: 15 },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
