import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { homeColors, homeSpace } from './homeTheme';

interface Props {
  statement: string;
}

// Static this phase — a persisted, editable "intention" is a later phase.
export function DailyFocusCard({ statement }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text style={styles.label}>DAILY FOCUS</Text>
        <Text style={styles.statement}>{statement}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: homeColors.card,
    borderRadius: homeSpace.cardRadius,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    overflow: 'hidden',
  },
  accentBar: { width: 4, backgroundColor: homeColors.accent },
  content: { flex: 1, paddingVertical: 16, paddingHorizontal: 16, gap: 6 },
  label: {
    fontSize: 11,
    color: homeColors.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statement: { fontSize: 17, color: homeColors.textPrimary, fontWeight: '600', lineHeight: 23 },
});
