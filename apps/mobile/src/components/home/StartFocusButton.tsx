import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, Alert } from 'react-native';
import { Zap } from 'lucide-react-native';
import { homeColors, homeSpace } from './homeTheme';

// Placeholder this phase — the Focus/Pomodoro feature lands in a later phase.
export function StartFocusButton() {
  const handlePress = useCallback(() => {
    Alert.alert('Coming soon', 'Focus sessions are on the way.');
  }, []);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Start focus session"
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
      style={styles.button}
    >
      <Zap size={18} color="#fff" fill="#fff" strokeWidth={2} />
      <Text style={styles.text}>Start Focus Session</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: homeColors.accent,
    borderRadius: homeSpace.cardRadius,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
