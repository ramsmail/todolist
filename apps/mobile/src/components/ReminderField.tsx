import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, typography } from '@thinkdo/ui';
import {
  REMINDER_OFFSET_MINUTES, computeReminderFromOffset, computeReminderFromCustomDate,
  type ReminderOffsetKey,
} from '../lib/reminderOffsets';
import { ReminderPickerSheet } from './ReminderPickerSheet';

interface Props {
  dueDate: string | null;
  dueTime: string | null;
  reminderLocal: string | null;
  onSet: (remindAtLocal: string, remindAtUtc: string) => void;
  onRemove: () => void;
}

export function ReminderField({ dueDate, dueTime, reminderLocal, onSet, onRemove }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [showIosPicker, setShowIosPicker] = useState(false);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  const pickOffset = useCallback((key: ReminderOffsetKey) => {
    if (!dueDate || !dueTime) return;
    const { remindAtLocal, remindAtUtc } = computeReminderFromOffset(dueDate, dueTime, REMINDER_OFFSET_MINUTES[key]);
    onSet(remindAtLocal, remindAtUtc);
    closeSheet();
  }, [dueDate, dueTime, onSet, closeSheet]);

  const applyCustom = useCallback((date: Date) => {
    const { remindAtLocal, remindAtUtc } = computeReminderFromCustomDate(date);
    onSet(remindAtLocal, remindAtUtc);
  }, [onSet]);

  const pickCustom = useCallback(() => {
    closeSheet();
    if (Platform.OS === 'android') {
      const base = new Date();
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        display: 'default',
        onValueChange: (_e, selectedDate) => {
          if (!selectedDate) return;
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: 'time',
            display: 'default',
            onValueChange: (_e2, selectedTime) => {
              if (!selectedTime) return;
              const combined = new Date(selectedDate);
              combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              applyCustom(combined);
            },
          });
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }, [applyCustom, closeSheet]);

  const handleIosChange = useCallback((_e: unknown, selectedDate?: Date) => {
    setShowIosPicker(false);
    if (selectedDate) applyCustom(selectedDate);
  }, [applyCustom]);

  return (
    <View style={styles.row}>
      <Pressable onPress={openSheet}>
        <Text style={styles.value}>{reminderLocal ?? 'No reminder'}</Text>
      </Pressable>
      {reminderLocal && (
        <Pressable onPress={onRemove}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      )}

      <ReminderPickerSheet
        visible={sheetVisible}
        hasDueTime={!!(dueDate && dueTime)}
        onPickOffset={pickOffset}
        onPickCustom={pickCustom}
        onClose={closeSheet}
      />

      {showIosPicker && (
        <DateTimePicker
          value={new Date()}
          mode="datetime"
          display="default"
          onValueChange={handleIosChange}
          onDismiss={() => setShowIosPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { ...typography.body, color: colors.textSecondary },
  clear: { ...typography.caption, color: colors.accent, fontWeight: '600' },
});
