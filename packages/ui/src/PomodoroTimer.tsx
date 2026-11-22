import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from './tokens';

interface PomodoroTimerProps {
  displayTime: string; // "MM:SS" format from usePomodoro
  isRunning: boolean;
}

/**
 * Visual timer display showing MM:SS format.
 * Border color changes to accent when running to indicate activity.
 */
export const PomodoroTimer = React.memo(function PomodoroTimer({ displayTime, isRunning }: PomodoroTimerProps) {
  return (
    <View
      style={[styles.container, isRunning && styles.running]}
      testID="pomodoro-timer"
      accessibilityRole="timer"
    >
      <Text style={styles.icon} importantForAccessibility="no">🍅</Text>
      <Text style={styles.time}>{displayTime}</Text>
    </View>
  );
});

// Softer than colors.p1 so the timer reads as a tint, not an alert.
const TIMER_RED = '#F87171';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  running: {
    borderColor: colors.accent,
  },
  icon: {
    fontSize: 14,
  },
  time: {
    ...typography.heading2,
    color: TIMER_RED,
    fontFamily: 'monospace', // Monospace so digits don't shift width
  },
});
