import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { TaskCheckbox } from './TaskCheckbox';
import { PriorityBadge } from './PriorityBadge';
import { colors, typography } from './tokens';

interface Props {
  id: string;
  title: string;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  completed?: boolean;
  onPress: (id: string) => void;
  onComplete: (id: string) => void;
}

export function TaskRow({ id, title, priority, dueDate, completed = false, onPress, onComplete }: Props) {
  const isOverdue = !completed && !!dueDate && dueDate < new Date().toISOString().split('T')[0];

  return (
    <Pressable style={styles.row} onPress={() => onPress(id)}>
      <TaskCheckbox priority={priority} checked={completed} onComplete={() => onComplete(id)} />
      <View style={styles.content}>
        <Text
          style={[styles.title, completed && styles.titleDone]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {dueDate && (
          <Text style={[styles.due, isOverdue && styles.dueOverdue]}>
            {dueDate}
          </Text>
        )}
      </View>
      <PriorityBadge priority={priority} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  due: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  dueOverdue: { color: colors.p1 },
});
