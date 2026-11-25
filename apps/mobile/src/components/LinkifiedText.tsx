import { Text, Linking, type TextStyle, type StyleProp } from 'react-native';
import { splitTextWithLinks, toHref } from '@todolist/core';
import { colors } from '@todolist/ui';

export function LinkifiedText({ text, style }: { text: string | null | undefined; style?: StyleProp<TextStyle> }) {
  const segments = splitTextWithLinks(text ?? '');
  return (
    <Text style={style}>
      {segments.map((segment, i) =>
        segment.type === 'link' ? (
          <Text
            key={i}
            style={{ color: colors.accent }}
            onPress={() => Linking.openURL(toHref(segment.value))}
          >
            {segment.value}
          </Text>
        ) : (
          <Text key={i}>{segment.value}</Text>
        )
      )}
    </Text>
  );
}
