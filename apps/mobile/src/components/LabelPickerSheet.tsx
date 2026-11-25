import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLabels } from '@todolist/db';
import { colors, typography } from '@todolist/ui';

interface Props {
  visible: boolean;
  selected: string[];
  onChange: (labels: string[]) => void;
  onClose: () => void;
}

export function LabelPickerSheet({ visible, selected, onChange, onClose }: Props) {
  const { data: labels } = useLabels();
  const [newLabel, setNewLabel] = useState('');

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter(l => l !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const addNew = () => {
    const name = newLabel.trim().toLowerCase();
    if (!name || selected.includes(name)) return;
    onChange([...selected, name]);
    setNewLabel('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>Labels</Text>
          {labels.map(l => {
            const name = l.name;
            if (!name) return null;
            const isSelected = selected.includes(name);
            return (
              <Pressable
                key={l.id}
                style={styles.option}
                onPress={() => toggle(name)}
                testID={`label-option-${name}`}
              >
                <View style={[styles.checkbox, isSelected && { backgroundColor: l.color ?? colors.accent, borderColor: l.color ?? colors.accent }]} />
                <Text style={styles.optionText}>{name}</Text>
              </Pressable>
            );
          })}
          <View style={styles.newLabelRow}>
            <TextInput
              style={styles.input}
              value={newLabel}
              onChangeText={setNewLabel}
              onSubmitEditing={addNew}
              placeholder="New label…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
            />
          </View>
          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heading: { ...typography.heading3, color: colors.textMuted, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.border,
  },
  optionText: { ...typography.body, color: colors.textPrimary },
  newLabelRow: { marginTop: 12 },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
