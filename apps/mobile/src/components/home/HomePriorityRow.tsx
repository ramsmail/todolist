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
import { parseLabelsJson } from '@todolist/core';
import { homeColors, homeRowTint } from './homeTheme';

export interface PriorityRowData {
  id: string;
  title: string;
  priority: number;
  labels?: string | null;
}

interface Props {
  task: PriorityRowData;
  onPress: (id: string) => void;
  onComplete: (id: string) => void;
}

// Light-themed swipe-left-to-complete row for the Home dashboard.
// Mirrors SwipeableTaskRow's interaction but with the Home light palette;
// reuses the theme-neutral TaskCheckbox.
export function HomePriorityRow({ task, onPress, onComplete }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const opacity = useSharedValue(1);
  const category = parseLabelsJson(task.labels)[0] ?? null;

  useEffect(() => {
    opacity.value = 1;
  }, [task.id, opacity]);

  const closeSwipe = useCallback(() => swipeRef.current?.close(), []);

  const handleComplete = useCallback(() => {
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(closeSwipe)();
      runOnJS(onComplete)(task.id);
    });
  }, [onComplete, opacity, closeSwipe, task.id]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

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
          {category && <Text style={styles.category}>{category}</Text>}
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
  category: { fontSize: 12, color: homeColors.textSecondary },
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
