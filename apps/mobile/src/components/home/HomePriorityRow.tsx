import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { TaskCheckbox } from '@todolist/ui';
import { parseLabelsJson, parseRule, describeRule } from '@todolist/core';
import { homeColors, homeRowTint } from './homeTheme';

export interface PriorityRowData {
  id: string;
  title: string;
  priority: number;
  due_date?: string | null;
  status?: string;
  labels?: string | null;
  recurrence_rule?: string | null;
}

interface Props {
  task: PriorityRowData;
  onPress: (id: string) => void;
  // May reject; the row restores itself rather than staying hidden on failure.
  onComplete: (id: string) => void | Promise<void>;
}

// Light-themed swipe-left-to-complete row for the Home dashboard.
// Mirrors SwipeableTaskRow's interaction but with the Home light palette;
// reuses the theme-neutral TaskCheckbox.
export function HomePriorityRow({ task, onPress, onComplete }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const opacity = useSharedValue(1);
  const category = parseLabelsJson(task.labels)[0] ?? null;

  // The row hides itself before the write lands, and normally the task then
  // drops out of the query and this component unmounts. A recurring task does
  // not: completeTask advances its due_date and keeps the same id, so React
  // reuses this instance. Keying the reset on id alone left the row invisible
  // but still occupying space, which read as "the task wouldn't delete".
  // due_date/status cover every field completion can change.
  useEffect(() => {
    opacity.value = 1;
  }, [task.id, task.due_date, task.status, opacity]);

  const closeSwipe = useCallback(() => swipeRef.current?.close(), []);

  // If the write fails, nothing removes this row from the list, so bring it
  // back instead of leaving an invisible row holding empty space.
  const runComplete = useCallback(() => {
    Promise.resolve(onComplete(task.id)).catch(() => {
      opacity.value = withTiming(1, { duration: 150 });
    });
  }, [onComplete, task.id, opacity]);

  const handleComplete = useCallback(() => {
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(closeSwipe)();
      runOnJS(runComplete)();
    });
  }, [runComplete, opacity, closeSwipe]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const rule = task.recurrence_rule ? parseRule(task.recurrence_rule) : null;
  const repeat = rule ? describeRule(rule) : null;

  const renderLeftAction = useCallback(() => (
    <View style={styles.actionComplete}>
      <Text style={styles.actionText}>✓ Done</Text>
    </View>
  ), []);

  const handleRowPress = useCallback(() => onPress(task.id), [onPress, task.id]);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      renderLeftActions={renderLeftAction}
      onSwipeableLeftOpen={handleComplete}
    >
      <Animated.View style={[styles.row, { backgroundColor: homeRowTint(task.priority) }, rowStyle]}>
        <TaskCheckbox priority={task.priority as 1 | 2 | 3 | 4} onComplete={handleComplete} />
        <Pressable style={styles.content} onPress={handleRowPress}>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          <View style={styles.metaRow}>
            {category && <Text style={styles.category}>{category}</Text>}
            {repeat && <Text style={styles.repeat}>↻ {repeat}</Text>}
          </View>
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  content: { flex: 1, gap: 3 },
  title: { fontSize: 15, color: homeColors.textPrimary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  category: { fontSize: 12, color: homeColors.textSecondary },
  repeat: { fontSize: 12, color: homeColors.textMuted },
  actionComplete: {
    backgroundColor: homeColors.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    width: 100,
    borderRadius: 14,
    marginBottom: 10,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
