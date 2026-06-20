import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { priorityColor, priorityLabel } from './tokens';

interface Props {
  priority: 1 | 2 | 3 | 4;
}

export function PriorityBadge({ priority }: Props) {
  if (priority === 4) return null;  // P4 is default, don't clutter the row
  return (
    <View style={[styles.badge, { borderColor: priorityColor[priority] }]}>
      <Text style={[styles.label, { color: priorityColor[priority] }]}>
        {priorityLabel[priority]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
