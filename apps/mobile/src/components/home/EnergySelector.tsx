import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { usePowerSync } from '@powersync/react';
import { useTodayEnergy, setEnergy } from '@todolist/db';
import { useAuth } from '../../auth/AuthContext';
import { homeColors, homeSpace } from './homeTheme';

const LEVELS = [1, 2, 3, 4, 5] as const;
const LEVEL_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Fair',
  3: 'Medium',
  4: 'High',
  5: 'Peak',
};

export function EnergySelector() {
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
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Energy Level</Text>
        <Text style={[styles.level, selected == null && styles.levelUnset]}>
          {selected != null ? LEVEL_LABEL[selected] : 'Not set'}
        </Text>
      </View>

      <View style={styles.segments}>
        {LEVELS.map((level) => {
          const active = selected != null && level <= selected;
          return (
            <Pressable
              key={level}
              onPress={() => handleSelect(level)}
              accessibilityRole="button"
              accessibilityLabel={`Set energy to ${LEVEL_LABEL[level]}`}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Zap
                size={18}
                color={active ? homeColors.energy : homeColors.textMuted}
                fill={active ? homeColors.energy : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeColors.card,
    borderRadius: homeSpace.cardRadius,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 16,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, color: homeColors.textPrimary, fontWeight: '600' },
  level: { fontSize: 15, color: homeColors.energy, fontWeight: '700' },
  levelUnset: { color: homeColors.textMuted, fontWeight: '500' },
  segments: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: homeColors.segmentBorder,
    backgroundColor: homeColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    borderColor: homeColors.energyBorder,
    backgroundColor: homeColors.energySoft,
  },
});
