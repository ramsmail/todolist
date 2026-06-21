import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@todolist/ui';

export function TaskDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Task Detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { ...typography.body, color: colors.textSecondary },
});
