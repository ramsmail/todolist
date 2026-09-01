import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../tokens';

interface TimerControlsProps {
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

/**
 * Control buttons for the pomodoro timer.
 * Shows Start button when stopped; Pause button when running.
 * Always shows Reset button.
 */
export const TimerControls = React.memo(function TimerControls({
  isRunning,
  onStart,
  onPause,
  onReset,
}: TimerControlsProps) {
  return (
    <View style={styles.container}>
      {!isRunning ? (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onStart}
          testID="timer-start-button"
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Start
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onPause}
          testID="timer-pause-button"
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Pause
          </Text>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={onReset}
        testID="timer-reset-button"
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>
          Reset
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.body,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: colors.textPrimary,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
  },
});
