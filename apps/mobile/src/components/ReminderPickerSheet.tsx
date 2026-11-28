import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography } from '@thinkdo/ui';
import type { ReminderOffsetKey } from '../lib/reminderOffsets';

interface Props {
  visible: boolean;
  hasDueTime: boolean;
  onPickOffset: (key: ReminderOffsetKey) => void;
  onPickCustom: () => void;
  onClose: () => void;
}

const OFFSET_LABELS: { key: ReminderOffsetKey; label: string }[] = [
  { key: 'due', label: 'At due time' },
  { key: '10min', label: '10 minutes before' },
  { key: '30min', label: '30 minutes before' },
  { key: '1hour', label: '1 hour before' },
];

export function ReminderPickerSheet({ visible, hasDueTime, onPickOffset, onPickCustom, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>Remind me</Text>
          {hasDueTime && OFFSET_LABELS.map(({ key, label }) => (
            <Pressable key={key} style={styles.option} onPress={() => onPickOffset(key)}>
              <Text style={styles.optionText}>{label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.option} onPress={onPickCustom}>
            <Text style={styles.optionText}>Custom…</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heading: { ...typography.heading3, color: colors.textMuted, marginBottom: 8 },
  option: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optionText: { ...typography.body, color: colors.textPrimary },
});
