import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, typography } from '@todolist/ui';
import { parseDueDate, formatDueDateForStorage } from '../lib/dueDateFormat';

interface Props {
  dueDate:  string | null;
  onChange: (dueDate: string | null) => void;
}

export function DueDateField({ dueDate, onChange }: Props) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const handlePicked = useCallback((selectedDate?: Date) => {
    if (selectedDate) {
      onChange(formatDueDateForStorage(selectedDate));
    }
  }, [onChange]);

  const openPicker = useCallback(() => {
    const value = parseDueDate(dueDate) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        display: 'default',
        onValueChange: (_event, selectedDate) => handlePicked(selectedDate),
      });
    } else {
      setShowIosPicker(true);
    }
  }, [dueDate, handlePicked]);

  const handleIosChange = useCallback((_event: unknown, selectedDate?: Date) => {
    setShowIosPicker(false);
    handlePicked(selectedDate);
  }, [handlePicked]);

  const handleIosDismiss = useCallback(() => setShowIosPicker(false), []);

  const handleClear = useCallback(() => onChange(null), [onChange]);

  return (
    <View style={styles.row}>
      <Pressable onPress={openPicker}>
        <Text style={styles.dueDate}>{dueDate ?? 'No date'}</Text>
      </Pressable>
      {dueDate && (
        <Pressable onPress={handleClear}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      )}
      {showIosPicker && (
        <DateTimePicker
          value={parseDueDate(dueDate) ?? new Date()}
          mode="date"
          display="default"
          onValueChange={handleIosChange}
          onDismiss={handleIosDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dueDate: { ...typography.body, color: colors.textSecondary },
  clear: { ...typography.caption, color: colors.accent, fontWeight: '600' },
});
