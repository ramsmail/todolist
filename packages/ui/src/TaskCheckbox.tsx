import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { priorityColor } from './tokens';

interface Props {
  priority: 1 | 2 | 3 | 4;
  checked?: boolean;
  onComplete: () => void;
}

export function TaskCheckbox({ priority, checked = false, onComplete }: Props) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.85, {}, () => {
      scale.value = withSpring(1);
      runOnJS(onComplete)();
    });
  }, [onComplete, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderColor = priorityColor[priority];

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View style={[styles.box, { borderColor }, animatedStyle]}>
        {checked && <View style={[styles.fill, { backgroundColor: borderColor }]} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
