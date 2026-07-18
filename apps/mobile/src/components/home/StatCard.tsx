import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressRing } from './ProgressRing';
import { homeColors, homeSpace } from './homeTheme';

interface Props {
  label: string;
  value: string;
  progress: number;
  color?: string;
}

export function StatCard({ label, value, progress, color }: Props) {
  return (
    <View style={styles.card}>
      <ProgressRing progress={progress} color={color} size={56} strokeWidth={5} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: homeColors.card,
    borderRadius: homeSpace.cardRadius,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  label: { fontSize: 12, color: homeColors.textSecondary, fontWeight: '500' },
  value: { fontSize: 15, color: homeColors.textPrimary, fontWeight: '700' },
});
