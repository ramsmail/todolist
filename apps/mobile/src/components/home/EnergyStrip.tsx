import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { usePowerSync } from '@powersync/react';
import { useTodayEnergy, setEnergy } from '@thinkdo/db';
import { useAuth } from '../../auth/AuthContext';
import { homeColors } from './homeTheme';

const LEVELS = [1, 2, 3, 4, 5] as const;
const LEVEL_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Fair',
  3: 'Medium',
  4: 'High',
  5: 'Peak',
};

// Row-shaped energy picker for the Today header. Same write path as the
// card-shaped EnergySelector it replaces, about a third of the height, so the
// header can carry it without pushing the task list below the fold.
export function EnergyStrip() {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { energy } = useTodayEnergy();
  const [optimistic, setOptimistic] = useState<number | null>(null);

  const selected = optimistic ?? energy;

  const handleSelect = useCallback((level: number) => {
    if (!userId) return;
    setOptimistic(level);
    setEnergy(db as any, userId, level).catch(console.error);
  }, [db, userId]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Energy</Text>
      <View style={styles.segments}>
        {LEVELS.map((level) => {
          const active = selected != null && level <= selected;
          return (
            <Pressable
              key={level}
              onPress={() => handleSelect(level)}
              accessibilityRole="button"
              accessibilityLabel={`Set energy to ${LEVEL_LABEL[level]}`}
              accessibilityState={{ selected: active }}
              hitSlop={6}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Zap
                size={14}
                color={active ? homeColors.energy : homeColors.textMuted}
                fill={active ? homeColors.energy : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.value, selected == null && styles.valueUnset]}>
        {selected != null ? LEVEL_LABEL[selected] : 'Not set'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 12, color: homeColors.textSecondary, fontWeight: '600' },
  segments: { flexDirection: 'row', gap: 4, flex: 1 },
  segment: {
    width: 30,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: homeColors.segmentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: homeColors.energySoft,
    borderColor: homeColors.energyBorder,
  },
  value: { fontSize: 12, color: homeColors.energy, fontWeight: '600' },
  valueUnset: { color: homeColors.textMuted, fontWeight: '500' },
});
