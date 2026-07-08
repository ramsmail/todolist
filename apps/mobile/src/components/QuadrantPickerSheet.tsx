import React, { useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { quadrantLabel } from '@todolist/core';
import { colors, typography } from '@todolist/ui';

const QUADRANTS = [1, 2, 3, 4] as const;

interface Props {
  visible: boolean;
  onSelect: (quadrant: 1 | 2 | 3 | 4) => void;
  onClose: () => void;
}

export function QuadrantPickerSheet({ visible, onSelect, onClose }: Props) {
  const handleSelect = useCallback((quadrant: 1 | 2 | 3 | 4) => {
    onSelect(quadrant);
    onClose();
  }, [onSelect, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>Move to</Text>
          {QUADRANTS.map(quadrant => (
            <Pressable
              key={quadrant}
              style={styles.option}
              onPress={() => handleSelect(quadrant)}
              testID={`quadrant-option-${quadrant}`}
            >
              <Text style={styles.optionText}>{quadrantLabel[quadrant]}</Text>
            </Pressable>
          ))}
        </View>
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: { ...typography.body, color: colors.textPrimary },
});
