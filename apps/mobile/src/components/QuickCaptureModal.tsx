import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal, View, TextInput, Pressable, Text, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { usePowerSync } from '@powersync/react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { parseTaskInput, mergeLabels } from '@todolist/core';
import { createTask, ensureLabels, useLabels } from '@todolist/db';
import { useAuth }       from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';
import { resolveTaskPriority } from '../lib/resolveTaskPriority';
import { LabelChip } from './LabelChip';
import { LabelPickerSheet } from './LabelPickerSheet';

interface Props {
  visible:   boolean;
  projectId?: string | null;
  defaultPriority?: 1 | 2 | 3 | 4;
  onClose:   () => void;
}

export function QuickCaptureModal({ visible, projectId, defaultPriority, onClose }: Props) {
  const db              = usePowerSync();
  const { session }     = useAuth();
  const { data: allLabels } = useLabels();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [pickedLabels, setPickedLabels] = useState<string[]>([]);
  const [labelPickerVisible, setLabelPickerVisible] = useState(false);
  const [listening, setListening] = useState(false);
  // Text already in the input before this recognition session started — voice
  // transcript is appended after it rather than replacing it on each update.
  const baseInputRef = useRef('');

  // Stable ref so onClose is never a useCallback dependency (avoids churn)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!visible) ExpoSpeechRecognitionModule.stop();
  }, [visible]);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    const base = baseInputRef.current;
    setInput(base ? `${base} ${transcript}` : transcript);
  });

  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));

  const toggleListening = useCallback(async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    baseInputRef.current = input.trim();
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', continuous: true, interimResults: true });
  }, [listening, input]);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !session) return;

    setError(null);
    setSaving(true);
    let succeeded = false;
    try {
      const parsed = parseTaskInput(trimmed, { now: new Date() });
      const labels = mergeLabels(pickedLabels, parsed.labels);
      if (labels.length) await ensureLabels(db as any, session.user.id, labels);
      // Note: parsed.projectSlug (#tag) is not yet resolved to an ID — projectId prop takes precedence
      await createTask(db as any, {
        userId:    session.user.id,
        title:     parsed.title,
        priority:  resolveTaskPriority(parsed.priority, defaultPriority),
        dueDate:   parsed.dueDate,
        dueTime:   parsed.dueTime,
        timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId: projectId ?? null,
        labels,
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
      setPickedLabels([]);
      onCloseRef.current();
    }
  }, [db, input, session, projectId, defaultPriority, pickedLabels]);

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

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputWithMic]}
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
          <Pressable
            style={[styles.micBtn, listening && styles.micBtnActive]}
            onPress={toggleListening}
            testID="quick-capture-mic"
          >
            <Text style={styles.micIcon}>{listening ? '⏹' : '🎤'}</Text>
          </Pressable>
        </View>
        {listening && <Text style={styles.listeningHint}>Listening…</Text>}

        <Pressable style={styles.labelsRow} onPress={() => setLabelPickerVisible(true)} testID="quick-capture-labels">
          {pickedLabels.length > 0 ? (
            <View style={styles.labelChips}>
              {pickedLabels.map(name => (
                <LabelChip key={name} name={name} color={allLabels.find(l => l.name === name)?.color ?? colors.accent} />
              ))}
            </View>
          ) : (
            <Text style={styles.labelsPlaceholder}>Add labels</Text>
          )}
        </Pressable>

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

      <LabelPickerSheet
        visible={labelPickerVisible}
        selected={pickedLabels}
        onChange={setPickedLabels}
        onClose={() => setLabelPickerVisible(false)}
      />
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
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
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
  },
  inputWithMic: { flex: 1 },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: colors.error, borderColor: colors.error },
  micIcon: { fontSize: 18 },
  listeningHint: { ...typography.caption, color: colors.accent, marginBottom: 12 },
  labelsRow: { marginBottom: 16, minHeight: 24, justifyContent: 'center' },
  labelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  labelsPlaceholder: { ...typography.body, color: colors.textMuted },
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
