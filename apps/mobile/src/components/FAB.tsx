import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors } from '@todolist/ui';

interface Props {
  onPress: () => void;
}

export function FAB({ onPress }: Props) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn  = useCallback(() => { scale.value = withSpring(0.92); }, [scale]);
  const handlePressOut = useCallback(() => { scale.value = withSpring(1); }, [scale]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={styles.pressable}
      accessibilityLabel="Add task"
      accessibilityRole="button"
    >
      <Animated.View style={[styles.fab, style]}>
        <Text style={styles.icon}>+</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { position: 'absolute', bottom: 24, right: 24, zIndex: 10 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
