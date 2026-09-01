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
export function PomodoroTimer({ displayTime, isRunning }: PomodoroTimerProps) {
  return (
    <View style={[styles.container, isRunning && styles.running]}>
      <Text style={styles.time}>{displayTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
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
  time: {
    ...typography.heading2,
    color: colors.textPrimary,
    fontFamily: 'monospace', // Monospace so digits don't shift width
  },
});
