import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { quadrantLabel } from '@todolist/core';
import { typography, priorityColor } from '@todolist/ui';
import { homeColors } from './home/homeTheme';

const QUADRANTS = [1, 2, 3, 4] as const;

interface Props {
  active:   1 | 2 | 3 | 4;
  onChange: (quadrant: 1 | 2 | 3 | 4) => void;
}

export function QuadrantTabs({ active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {QUADRANTS.map(quadrant => {
        const isActive = quadrant === active;
        return (
          <Pressable
            key={quadrant}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(quadrant)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && { color: priorityColor[quadrant] }]}>
              {quadrantLabel[quadrant]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: homeColors.sectionBg,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: homeColors.card,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  label: { ...typography.caption, color: homeColors.textMuted, fontWeight: '600' },
});
