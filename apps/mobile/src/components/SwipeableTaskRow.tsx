import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { TaskCheckbox, PriorityBadge, typography } from '@todolist/ui';
import { parseLabelsJson } from '@todolist/core';
import { useLabels } from '@todolist/db';
import { LabelChip } from './LabelChip';
import { homeColors, homePriorityColor, homeRowTint } from './home/homeTheme';

export interface TaskRowData {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
  labels?:  string | null;
}

interface Props {
  task:            TaskRowData;
  onPress:         (id: string) => void;
  onComplete:      (id: string) => void;
  onReschedule:    (id: string) => void;
  projectName?:    string | null;
  onPriorityPress?: (id: string) => void;
  variant?:        'flat' | 'panel';
}

export function SwipeableTaskRow({ task, onPress, onComplete, onReschedule, projectName, onPriorityPress, variant = 'flat' }: Props) {
  const swipeRef  = useRef<Swipeable>(null);
  const opacity   = useSharedValue(1);
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0];
  const isPanel   = variant === 'panel';
  const { data: allLabels } = useLabels();
  const labelNames = parseLabelsJson(task.labels);

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
    <View style={[styles.actionComplete, isPanel && styles.actionRounded]}>
      <Text style={styles.actionText}>✓ Done</Text>
    </View>
  ), [isPanel]);

  const renderRightAction = useCallback(() => (
    <View style={[styles.actionReschedule, isPanel && styles.actionRounded]}>
      <Text style={styles.actionText}>Later →</Text>
    </View>
  ), [isPanel]);

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
      <Animated.View
        style={[
          styles.row,
          isPanel && styles.rowPanel,
          isPanel && { backgroundColor: homeRowTint(task.priority) },
          rowStyle,
        ]}
      >
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
          {labelNames.length > 0 && (
            <View style={styles.labelsRow}>
              {labelNames.map(name => (
                <LabelChip
                  key={name}
                  name={name}
                  color={allLabels.find(l => l.name === name)?.color ?? homeColors.accent}
                />
              ))}
            </View>
          )}
          {!isPanel && projectName && (
            <View style={styles.projectChip}>
              <Text style={styles.projectChipText}>{projectName}</Text>
            </View>
          )}
        </Pressable>
        {isPanel ? (
          <View style={styles.panelRight}>
            <PriorityBadge
              priority={task.priority as 1 | 2 | 3 | 4}
              interactive={!!onPriorityPress}
              onPress={handlePriorityPress}
            />
            {projectName && (
              <View style={styles.projectChip}>
                <Text style={styles.projectChipText}>{projectName}</Text>
              </View>
            )}
          </View>
        ) : (
          <PriorityBadge
            priority={task.priority as 1 | 2 | 3 | 4}
            interactive={!!onPriorityPress}
            onPress={handlePriorityPress}
          />
        )}
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: homeColors.card,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeColors.cardBorder,
    gap: 12,
  },
  rowPanel: {
    borderRadius: 14,
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: homeColors.textPrimary },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  due:   { ...typography.caption, color: homeColors.textSecondary, marginTop: 3 },
  overdue: { color: homePriorityColor[1] },
  panelRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  projectChip: {
    alignSelf: 'flex-start',
    backgroundColor: homeColors.sectionBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  projectChipText: { ...typography.caption, color: homeColors.textMuted, fontSize: 11 },
  actionComplete: {
    backgroundColor: homeColors.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    width: 100,
  },
  actionReschedule: {
    backgroundColor: homeColors.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    width: 100,
  },
  actionRounded: {
    borderRadius: 14,
    marginHorizontal: 16,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
