import React from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { View, Text, Pressable } from 'react-native';
import { AppTabs }        from './AppTabs';
import { ProjectScreen }  from '../screens/ProjectScreen';
import { useProjects }    from '@todolist/db';
import { useAuth }        from '../auth/AuthContext';
import { colors }         from '@todolist/ui';

export type AppDrawerParamList = {
  Main:    undefined;
  Project: { id: string; name: string };
};

const Drawer = createDrawerNavigator<AppDrawerParamList>();

function DrawerContent(props: DrawerContentComponentProps) {
  const { data: projects } = useProjects();
  const { signOut }        = useAuth();
  const nav                = props.navigation;

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ flex: 1 }}
    >
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
          TodoList
        </Text>
      </View>

      <DrawerItemList {...props} />

      {projects && projects.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{
            color: colors.textMuted, fontSize: 11, fontWeight: '600',
            paddingHorizontal: 16, paddingBottom: 8, letterSpacing: 0.8,
          }}>
            PROJECTS
          </Text>
          {projects.map(p => (
            <Pressable
              key={p.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
              onPress={() => nav.navigate('Project', { id: p.id, name: p.name })}
            >
              <Text style={{ fontSize: 16, marginRight: 10 }}>{p.icon}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{p.name}</Text>
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: p.color ?? undefined, marginLeft: 'auto',
              }} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ marginTop: 'auto', padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable onPress={() => { signOut().catch(console.error); }}>
          <Text style={{ color: colors.error, fontSize: 15 }}>Sign out</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

export function AppDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={props => <DrawerContent {...props} />}
      screenOptions={{
        headerShown:        false,
        drawerStyle:        { backgroundColor: colors.surface, width: 280 },
        drawerActiveTintColor:   colors.accent,
        drawerInactiveTintColor: colors.textSecondary,
        swipeEdgeWidth:     40,
      }}
    >
      <Drawer.Screen name="Main"    component={AppTabs} options={{ title: 'Tasks' }} />
      <Drawer.Screen name="Project" component={ProjectScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}
