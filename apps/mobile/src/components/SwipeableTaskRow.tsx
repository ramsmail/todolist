import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { TaskCheckbox, PriorityBadge, colors, typography } from '@todolist/ui';

export interface TaskRowData {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
}

interface Props {
  task:          TaskRowData;
  onPress:       (id: string) => void;
  onComplete:    (id: string) => void;
  onReschedule:  (id: string) => void;
}

export function SwipeableTaskRow({ task, onPress, onComplete, onReschedule }: Props) {
  const swipeRef   = useRef<Swipeable>(null);
  const opacity    = useSharedValue(1);
  const isOverdue  = task.due_date && task.due_date < new Date().toISOString().split('T')[0];

  const handleComplete = useCallback((id: string) => {
    opacity.value = withTiming(0, { duration: 250 }, () => runOnJS(onComplete)(id));
  }, [onComplete, opacity]);

  const handleSwipeLeft = useCallback(() => {
    swipeRef.current?.close();
    handleComplete(task.id);
  }, [handleComplete, task.id]);

  const handleSwipeRight = useCallback(() => {
    swipeRef.current?.close();
    onReschedule(task.id);
  }, [onReschedule, task.id]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const renderLeftAction = () => (
    <View style={styles.actionComplete}>
      <Text style={styles.actionText}>✓ Done</Text>
    </View>
  );

  const renderRightAction = () => (
    <View style={styles.actionReschedule}>
      <Text style={styles.actionText}>Later →</Text>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={renderLeftAction}
      renderRightActions={renderRightAction}
      onSwipeableLeftOpen={handleSwipeLeft}
      onSwipeableRightOpen={handleSwipeRight}
    >
      <Animated.View style={[styles.row, rowStyle]}>
        <TaskCheckbox
          priority={task.priority as 1 | 2 | 3 | 4}
          onComplete={() => handleComplete(task.id)}
        />
        <Pressable style={styles.content} onPress={() => onPress(task.id)}>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          {task.due_date && (
            <Text style={[styles.due, isOverdue ? styles.overdue : null]}>
              {task.due_date}
            </Text>
          )}
        </Pressable>
        <PriorityBadge priority={task.priority as 1 | 2 | 3 | 4} />
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  due:   { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  overdue: { color: colors.p1 },
  actionComplete: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    width: 100,
  },
  actionReschedule: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    width: 100,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
