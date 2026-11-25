import React from 'react';
import { Text, StyleSheet, View, Pressable } from 'react-native';
import { priorityColor, priorityLabel } from './tokens';
import { shouldRenderPriorityBadge } from './priorityBadgeLogic';

interface Props {
  priority: 1 | 2 | 3 | 4;
  interactive?: boolean;
  onPress?: () => void;
}

export function PriorityBadge({ priority, interactive = false, onPress }: Props) {
  if (!shouldRenderPriorityBadge(priority, interactive)) return null;

  const badge = (
    <View style={[styles.badge, { borderColor: priorityColor[priority] }]}>
      <Text style={[styles.label, { color: priorityColor[priority] }]}>
        {priorityLabel[priority]}
      </Text>
    </View>
  );

  if (interactive && onPress) {
    return <Pressable onPress={onPress}>{badge}</Pressable>;
  }
  return badge;
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
