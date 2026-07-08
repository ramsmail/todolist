import React, { useCallback, useEffect, useRef } from 'react';
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
  task:            TaskRowData;
  onPress:         (id: string) => void;
  onComplete:      (id: string) => void;
  onReschedule:    (id: string) => void;
  projectName?:    string | null;
  onPriorityPress?: (id: string) => void;
}

export function SwipeableTaskRow({ task, onPress, onComplete, onReschedule, projectName, onPriorityPress }: Props) {
  const swipeRef  = useRef<Swipeable>(null);
  const opacity   = useSharedValue(1);
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0];

  // Reset opacity when FlatList recycles this cell for a different task
  useEffect(() => {
    opacity.value = 1;
  }, [task.id, opacity]);

  const closeSwipe = useCallback(() => {
    swipeRef.current?.close();
  }, []);

  const handleComplete = useCallback((id: string) => {
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(closeSwipe)();
      runOnJS(onComplete)(id);
    });
  }, [onComplete, opacity, closeSwipe]);

  const handleSwipeLeft = useCallback(() => {
    handleComplete(task.id);
  }, [handleComplete, task.id]);

  const handleSwipeRight = useCallback(() => {
    swipeRef.current?.close();
    onReschedule(task.id);
  }, [onReschedule, task.id]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const renderLeftAction = useCallback(() => (
    <View style={styles.actionComplete}>
      <Text style={styles.actionText}>✓ Done</Text>
    </View>
  ), []);

  const renderRightAction = useCallback(() => (
    <View style={styles.actionReschedule}>
      <Text style={styles.actionText}>Later →</Text>
    </View>
  ), []);

  const handleCheckboxComplete = useCallback(() => handleComplete(task.id), [handleComplete, task.id]);
  const handleRowPress = useCallback(() => onPress(task.id), [onPress, task.id]);
  const handlePriorityPress = useCallback(() => onPriorityPress?.(task.id), [onPriorityPress, task.id]);

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
          onComplete={handleCheckboxComplete}
        />
        <Pressable style={styles.content} onPress={handleRowPress}>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          {task.due_date && (
            <Text style={[styles.due, isOverdue ? styles.overdue : null]}>
              {task.due_date}
            </Text>
          )}
          {projectName && (
            <View style={styles.projectChip}>
              <Text style={styles.projectChipText}>{projectName}</Text>
            </View>
          )}
        </Pressable>
        <PriorityBadge
          priority={task.priority as 1 | 2 | 3 | 4}
          interactive={!!onPriorityPress}
          onPress={handlePriorityPress}
        />
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
  projectChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  projectChipText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
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
