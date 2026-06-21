import React from 'react';
import { View, Text } from 'react-native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { AppDrawerParamList } from '../navigation/AppDrawer';

type Props = DrawerScreenProps<AppDrawerParamList, 'Project'>;

export function ProjectScreen({ route }: Props) {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-lg font-semibold">{route.params.name}</Text>
    </View>
  );
}
