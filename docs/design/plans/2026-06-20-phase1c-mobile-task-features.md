# Phase 1C — Mobile Task Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all placeholder screens with real content and build every Phase 1 task-management feature: live task lists with swipe gestures and animations, quick capture with NLP, task detail editing, sub-tasks, project management, sync status indicator, and a Detox E2E golden-path test.

**Architecture:** Each screen queries PowerSync's local SQLite via `useQuery` hooks from `@todolist/db` — queries are reactive and update automatically when data changes. Writes go through the `tasks.ts` / `projects.ts` helpers which hit PowerSync local storage and queue a background upload to Supabase. The NLP parser from `@todolist/core` powers quick capture.

**Tech Stack:** React Navigation (existing), react-native-gesture-handler (swipe), react-native-reanimated (spring animations), @powersync/react (useQuery), @todolist/core (NLP), @todolist/db (queries), Detox (E2E)

**Prerequisite:** Plan 1B complete — app authenticates, navigates, and syncs.

---

## File Map

```
apps/mobile/src/
├── screens/
│   ├── InboxScreen.tsx         # REPLACE placeholder
│   ├── TodayScreen.tsx         # REPLACE placeholder
│   ├── UpcomingScreen.tsx      # REPLACE placeholder
│   ├── ProjectScreen.tsx       # REPLACE placeholder
│   └── TaskDetailScreen.tsx    # NEW
├── components/
│   ├── SwipeableTaskRow.tsx    # swipe-to-complete + swipe-to-reschedule
│   ├── QuickCaptureModal.tsx   # FAB + NLP input modal
│   ├── SubTaskList.tsx         # inline sub-task list for TaskDetail
│   ├── DatePickerModal.tsx     # due date + time picker
│   ├── PriorityPicker.tsx      # P1–P4 selector sheet
│   ├── ProjectPicker.tsx       # project assignment sheet
│   └── FAB.tsx                 # floating action button
├── hooks/
│   └── useSyncStatus.ts        # derives SyncStatus from PowerSync state
└── navigation/
    └── AppTabs.tsx             # MODIFY — add TaskDetail stack on each tab
```

---

## Task 1: SwipeableTaskRow component

**Files:**
- Create: `apps/mobile/src/components/SwipeableTaskRow.tsx`

- [ ] **Step 1: Create apps/mobile/src/components/SwipeableTaskRow.tsx**

```typescript
import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { TaskCheckbox, PriorityBadge, colors, typography } from '@todolist/ui';

export interface TaskRowData {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
}

interface Props {
  task:          TaskRowData;
  onPress:       (id: string) => void;
  onComplete:    (id: string) => void;
  onReschedule:  (id: string) => void;
}

export function SwipeableTaskRow({ task, onPress, onComplete, onReschedule }: Props) {
  const swipeRef   = useRef<Swipeable>(null);
  const opacity    = useSharedValue(1);
  const isOverdue  = task.due_date && task.due_date < new Date().toISOString().split('T')[0];

  const handleComplete = useCallback((id: string) => {
    opacity.value = withTiming(0, { duration: 250 }, () => runOnJS(onComplete)(id));
  }, [onComplete, opacity]);

  const handleSwipeLeft = useCallback(() => {
    swipeRef.current?.close();
    handleComplete(task.id);
  }, [handleComplete, task.id]);

  const handleSwipeRight = useCallback(() => {
    swipeRef.current?.close();
    onReschedule(task.id);
  }, [onReschedule, task.id]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const renderLeftAction = () => (
    <View style={styles.actionComplete}>
      <Text style={styles.actionText}>✓ Done</Text>
    </View>
  );

  const renderRightAction = () => (
    <View style={styles.actionReschedule}>
      <Text style={styles.actionText}>Later →</Text>
    </View>
  );

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
      <Animated.View style={[styles.row, rowStyle]}>
        <TaskCheckbox
          priority={task.priority as 1 | 2 | 3 | 4}
          onComplete={() => handleComplete(task.id)}
        />
        <Pressable style={styles.content} onPress={() => onPress(task.id)}>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          {task.due_date && (
            <Text style={[styles.due, isOverdue ? styles.overdue : null]}>
              {task.due_date}
            </Text>
          )}
        </Pressable>
        <PriorityBadge priority={task.priority as 1 | 2 | 3 | 4} />
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  due:   { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  overdue: { color: colors.p1 },
  actionComplete: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    width: 100,
  },
  actionReschedule: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    width: 100,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/SwipeableTaskRow.tsx
git commit -m "feat(mobile): add SwipeableTaskRow with complete/reschedule gestures"
```

---

## Task 2: FAB and QuickCaptureModal

**Files:**
- Create: `apps/mobile/src/components/FAB.tsx`
- Create: `apps/mobile/src/components/QuickCaptureModal.tsx`

- [ ] **Step 1: Create apps/mobile/src/components/FAB.tsx**

```typescript
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors } from '@todolist/ui';

interface Props {
  onPress: () => void;
}

export function FAB({ onPress }: Props) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.92); }}
      onPressOut={() => { scale.value = withSpring(1); }}
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
```

- [ ] **Step 2: Create apps/mobile/src/components/QuickCaptureModal.tsx**

```typescript
import React, { useState, useRef, useCallback } from 'react';
import {
  Modal, View, TextInput, Pressable, Text, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { usePowerSync } from '@powersync/react';
import { parseTaskInput } from '@todolist/core';
import { createTask }    from '@todolist/db';
import { useAuth }       from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';

interface Props {
  visible:   boolean;
  projectId?: string | null;
  onClose:   () => void;
}

export function QuickCaptureModal({ visible, projectId, onClose }: Props) {
  const db              = usePowerSync();
  const { session }     = useAuth();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef        = useRef<TextInput>(null);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !session) return;

    setSaving(true);
    try {
      const parsed = parseTaskInput(trimmed, { now: new Date() });
      await createTask(db as any, {
        userId:    session.user.id,
        title:     parsed.title,
        priority:  parsed.priority,
        dueDate:   parsed.dueDate,
        dueTime:   parsed.dueTime,
        timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId: projectId ?? null,
        labels:    parsed.labels,
        status:    'inbox',
      });
      setInput('');
      onClose();
    } catch (e) {
      console.error('createTask failed:', e);
    } finally {
      setSaving(false);
    }
  }, [db, input, session, projectId, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.handle} />

        <Text style={styles.heading}>New task</Text>
        <Text style={styles.hint}>
          Tip: "Buy milk p1 #work @waiting tomorrow 3pm"
        </Text>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="What needs to be done?"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          autoFocus
          multiline
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={handleSave}
        />

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[styles.saveBtn, !input.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!input.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveText}>Add task</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.surfaceAlt ?? '#1C1C1C',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  heading: { ...typography.heading2, color: colors.textPrimary, marginBottom: 4 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: 16 },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: '500', fontSize: 15 },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/FAB.tsx apps/mobile/src/components/QuickCaptureModal.tsx
git commit -m "feat(mobile): add FAB and QuickCaptureModal with NLP parsing"
```

---

## Task 3: Inbox screen

**Files:**
- Modify: `apps/mobile/src/screens/InboxScreen.tsx` (replace placeholder)

- [ ] **Step 1: Replace InboxScreen.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView }         from 'react-native-safe-area-context';
import { usePowerSync }         from '@powersync/react';
import { useInboxTasks, completeTask, updateTaskDue } from '@todolist/db';
import { colors, typography }   from '@todolist/ui';
import { SwipeableTaskRow }     from '../components/SwipeableTaskRow';
import { QuickCaptureModal }    from '../components/QuickCaptureModal';
import { FAB }                  from '../components/FAB';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Inbox'>;

export function InboxScreen({ navigation }: Props) {
  const db            = usePowerSync();
  const { data: tasks } = useInboxTasks();
  const [captureOpen, setCaptureOpen] = useState(false);

  const handleComplete = useCallback(async (id: string) => {
    await completeTask(db as any, id);
  }, [db]);

  const handleReschedule = useCallback(async (id: string) => {
    // Move to tomorrow — full date picker implemented in Task 6
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];
    await updateTaskDue(db as any, id, date, null);
  }, [db]);

  const handlePress = useCallback((id: string) => {
    navigation.navigate('TaskDetail', { id });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Inbox is clear</Text>
          <Text style={styles.emptyBody}>Tap + to capture a task</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <SwipeableTaskRow
              task={item as any}
              onPress={handlePress}
              onComplete={handleComplete}
              onReschedule={handleReschedule}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <FAB onPress={() => setCaptureOpen(true)} />

      <QuickCaptureModal
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.heading3, color: colors.textPrimary, marginBottom: 8 },
  emptyBody:  { ...typography.body, color: colors.textMuted },
});
```

- [ ] **Step 2: Add TaskDetail route to navigation**

Modify `apps/mobile/src/navigation/AppTabs.tsx` — wrap each tab in a stack so TaskDetail can be pushed:

```typescript
import React from 'react';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text }                       from 'react-native';
import { InboxScreen }    from '../screens/InboxScreen';
import { TodayScreen }    from '../screens/TodayScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { SearchScreen }   from '../screens/SearchScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { colors }         from '@todolist/ui';

// Each tab gets its own stack so TaskDetail can be pushed from any tab
function tabStack(HomeScreen: React.ComponentType<any>, name: string) {
  const Stack = createNativeStackNavigator();
  return function TabStack() {
    return (
      <Stack.Navigator screenOptions={{
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
      }}>
        <Stack.Screen name={name} component={HomeScreen} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
      </Stack.Navigator>
    );
  };
}

const InboxStack    = tabStack(InboxScreen,    'Inbox');
const TodayStack    = tabStack(TodayScreen,    'Today');
const UpcomingStack = tabStack(UpcomingScreen, 'Upcoming');
const SearchStack   = tabStack(SearchScreen,   'Search');

export type AppTabsParamList = {
  InboxStack:    undefined;
  TodayStack:    undefined;
  UpcomingStack: undefined;
  SearchStack:   undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

function icon(label: string) {
  const map: Record<string, string> = {
    InboxStack: '📥', TodayStack: '☀️', UpcomingStack: '📅', SearchStack: '🔍',
  };
  return map[label] ?? '○';
}

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{icon(route.name)}</Text>,
        tabBarLabel: route.name.replace('Stack', ''),
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      })}
    >
      <Tab.Screen name="InboxStack"    component={InboxStack} />
      <Tab.Screen name="TodayStack"    component={TodayStack} />
      <Tab.Screen name="UpcomingStack" component={UpcomingStack} />
      <Tab.Screen name="SearchStack"   component={SearchStack} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 3: Create a placeholder TaskDetailScreen to avoid import errors**

Create `apps/mobile/src/screens/TaskDetailScreen.tsx` (full version in Task 6):

```typescript
import React from 'react';
import { View, Text } from 'react-native';
export function TaskDetailScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff' }}>Task Detail — coming in Task 6</Text>
    </View>
  );
}
```

- [ ] **Step 4: Verify Inbox renders tasks**

Start the app. Sign in. In Supabase SQL Editor create a task:
```sql
INSERT INTO tasks (user_id, title, status, priority, sort_order)
SELECT id, 'Test inbox task', 'inbox', 2, 'a0' FROM auth.users LIMIT 1;
```
Wait 5s. Inbox should show "Test inbox task" with orange P2 badge.

- [ ] **Step 5: Verify swipe-to-complete**

Swipe the task left past 60px.
Expected: task fades out and disappears from the list.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/InboxScreen.tsx apps/mobile/src/screens/TaskDetailScreen.tsx apps/mobile/src/navigation/AppTabs.tsx
git commit -m "feat(mobile): implement Inbox screen with live list, FAB, swipe gestures"
```

---

## Task 4: Today and Upcoming screens

**Files:**
- Modify: `apps/mobile/src/screens/TodayScreen.tsx`
- Modify: `apps/mobile/src/screens/UpcomingScreen.tsx`

- [ ] **Step 1: Replace TodayScreen.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { View, SectionList, Text, StyleSheet } from 'react-native';
import { SafeAreaView }         from 'react-native-safe-area-context';
import { usePowerSync }         from '@powersync/react';
import { useTodayTasks, completeTask, updateTaskDue } from '@todolist/db';
import { colors, typography }   from '@todolist/ui';
import { SwipeableTaskRow }     from '../components/SwipeableTaskRow';
import { QuickCaptureModal }    from '../components/QuickCaptureModal';
import { FAB }                  from '../components/FAB';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Today'>;

export function TodayScreen({ navigation }: Props) {
  const db            = usePowerSync();
  const { data: tasks } = useTodayTasks();
  const [captureOpen, setCaptureOpen] = useState(false);

  const today    = new Date().toISOString().split('T')[0];
  const overdue  = tasks.filter(t => t.due_date && t.due_date < today);
  const dueToday = tasks.filter(t => t.due_date === today);

  const sections = [
    ...(overdue.length  ? [{ title: 'Overdue',    data: overdue  }] : []),
    ...(dueToday.length ? [{ title: 'Today',       data: dueToday }] : []),
  ];

  const handleComplete = useCallback(async (id: string) => {
    await completeTask(db as any, id);
  }, [db]);

  const handleReschedule = useCallback(async (id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null);
  }, [db]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>All done for today 🎉</Text>
          <Text style={styles.emptyBody}>Nothing due today or overdue</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[
                styles.sectionTitle,
                section.title === 'Overdue' && { color: colors.p1 },
              ]}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SwipeableTaskRow
              task={item as any}
              onPress={id => navigation.navigate('TaskDetail', { id })}
              onComplete={handleComplete}
              onReschedule={handleReschedule}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
      <FAB onPress={() => setCaptureOpen(true)} />
      <QuickCaptureModal visible={captureOpen} onClose={() => setCaptureOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { ...typography.heading3, color: colors.textPrimary, marginBottom: 8 },
  emptyBody:     { ...typography.body, color: colors.textMuted },
  sectionHeader: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle:  { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.6 },
});
```

- [ ] **Step 2: Replace UpcomingScreen.tsx**

```typescript
import React, { useCallback } from 'react';
import { View, SectionList, Text, StyleSheet } from 'react-native';
import { SafeAreaView }         from 'react-native-safe-area-context';
import { usePowerSync }         from '@powersync/react';
import { useUpcomingTasks, completeTask, updateTaskDue } from '@todolist/db';
import { colors, typography }   from '@todolist/ui';
import { SwipeableTaskRow }     from '../components/SwipeableTaskRow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'Upcoming'>;

function groupByDate(tasks: any[]): { title: string; data: any[] }[] {
  const map = new Map<string, any[]>();
  for (const t of tasks) {
    const date = t.due_date ?? 'No date';
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(t);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export function UpcomingScreen({ navigation }: Props) {
  const db            = usePowerSync();
  const { data: tasks } = useUpcomingTasks();
  const sections      = groupByDate(tasks);

  const handleComplete = useCallback(async (id: string) => {
    await completeTask(db as any, id);
  }, [db]);

  const handleReschedule = useCallback(async (id: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    await updateTaskDue(db as any, id, d.toISOString().split('T')[0], null);
  }, [db]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing upcoming</Text>
          <Text style={styles.emptyBody}>Tasks due in the next 7 days appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SwipeableTaskRow
              task={item}
              onPress={id => navigation.navigate('TaskDetail', { id })}
              onComplete={handleComplete}
              onReschedule={handleReschedule}
            />
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { ...typography.heading3, color: colors.textPrimary, marginBottom: 8 },
  emptyBody:     { ...typography.body, color: colors.textMuted },
  sectionHeader: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle:  { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/TodayScreen.tsx apps/mobile/src/screens/UpcomingScreen.tsx
git commit -m "feat(mobile): implement Today and Upcoming screens with section lists"
```

---

## Task 5: Sub-task list component

**Files:**
- Create: `apps/mobile/src/components/SubTaskList.tsx`

- [ ] **Step 1: Create apps/mobile/src/components/SubTaskList.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { usePowerSync }        from '@powersync/react';
import { useSubtasks, createTask, completeTask } from '@todolist/db';
import { TaskCheckbox, colors, typography } from '@todolist/ui';
import { useAuth }             from '../auth/AuthContext';

interface Props {
  parentTaskId: string;
}

export function SubTaskList({ parentTaskId }: Props) {
  const db              = usePowerSync();
  const { session }     = useAuth();
  const { data: subtasks } = useSubtasks(parentTaskId);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || !session) return;
    await createTask(db as any, {
      userId:       session.user.id,
      title,
      parentTaskId,
      status:       'active',
      priority:     4,
    });
    setNewTitle('');
    setAdding(false);
  }, [db, newTitle, session, parentTaskId]);

  const handleComplete = useCallback(async (id: string) => {
    await completeTask(db as any, id);
  }, [db]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sub-tasks</Text>

      {subtasks.map(sub => (
        <View key={sub.id} style={styles.subtaskRow}>
          <TaskCheckbox
            priority={4}
            checked={sub.status === 'completed'}
            onComplete={() => handleComplete(sub.id)}
          />
          <Text style={[
            styles.subtaskTitle,
            sub.status === 'completed' && styles.done,
          ]}>
            {sub.title}
          </Text>
        </View>
      ))}

      {adding ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Sub-task title"
            placeholderTextColor={colors.textMuted}
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            blurOnSubmit={false}
          />
          <Pressable onPress={handleAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
          <Pressable onPress={() => { setAdding(false); setNewTitle(''); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.addTrigger} onPress={() => setAdding(true)}>
          <Text style={styles.addTriggerText}>+ Add sub-task</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { paddingHorizontal: 16, paddingTop: 24 },
  heading:        { ...typography.caption, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.6, marginBottom: 12 },
  subtaskRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  subtaskTitle:   { ...typography.body, color: colors.textPrimary, flex: 1 },
  done:           { textDecorationLine: 'line-through', color: colors.textMuted },
  addRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  addInput:       {
    flex: 1, ...typography.body, color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  addBtn:         { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  cancelText:     { color: colors.textMuted, fontSize: 14 },
  addTrigger:     { paddingVertical: 10 },
  addTriggerText: { color: colors.accent, fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/SubTaskList.tsx
git commit -m "feat(mobile): add SubTaskList component with inline add and complete"
```

---

## Task 6: Task detail screen

**Files:**
- Modify: `apps/mobile/src/screens/TaskDetailScreen.tsx` (replace placeholder)

- [ ] **Step 1: Replace TaskDetailScreen.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { usePowerSync }    from '@powersync/react';
import {
  useTask, updateTaskTitle, updateTaskDue,
  updateTaskPriority, updateTaskProject, deleteTask,
} from '@todolist/db';
import { SubTaskList }     from '../components/SubTaskList';
import { colors, typography, priorityColor, priorityLabel } from '@todolist/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'TaskDetail'>;

const PRIORITIES = [1, 2, 3, 4] as const;

export function TaskDetailScreen({ route, navigation }: Props) {
  const { id } = route.params as { id: string };
  const db     = usePowerSync();
  const { data: rows } = useTask(id);
  const task   = rows?.[0];

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState('');

  const handleTitleEdit = useCallback(() => {
    if (!task) return;
    setTitleDraft(task.title);
    setEditingTitle(true);
  }, [task]);

  const handleTitleSave = useCallback(async () => {
    if (titleDraft.trim() && task) {
      await updateTaskTitle(db as any, task.id, titleDraft.trim());
    }
    setEditingTitle(false);
  }, [db, task, titleDraft]);

  const handlePriority = useCallback(async (p: number) => {
    if (!task) return;
    await updateTaskPriority(db as any, task.id, p);
  }, [db, task]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete task', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteTask(db as any, id);
          navigation.goBack();
        },
      },
    ]);
  }, [db, id, navigation]);

  if (!task) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title */}
        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={titleDraft}
            onChangeText={setTitleDraft}
            autoFocus
            multiline
            returnKeyType="done"
            blurOnSubmit
            onBlur={handleTitleSave}
            onSubmitEditing={handleTitleSave}
          />
        ) : (
          <Pressable onPress={handleTitleEdit}>
            <Text style={styles.title}>{task.title}</Text>
          </Pressable>
        )}

        {/* Due date display */}
        {task.due_date && (
          <View style={styles.row}>
            <Text style={styles.label}>Due</Text>
            <Text style={styles.value}>{task.due_date}{task.due_time ? ` ${task.due_time}` : ''}</Text>
          </View>
        )}

        {/* Priority picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <Pressable
                key={p}
                style={[
                  styles.priorityBtn,
                  { borderColor: priorityColor[p] },
                  task.priority === p && { backgroundColor: priorityColor[p] },
                ]}
                onPress={() => handlePriority(p)}
              >
                <Text style={[
                  styles.priorityBtnText,
                  { color: task.priority === p ? '#fff' : priorityColor[p] },
                ]}>
                  {priorityLabel[p]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Status badge */}
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{task.status}</Text>
        </View>

        {/* Sub-tasks */}
        <SubTaskList parentTaskId={id} />

        {/* Delete */}
        <View style={styles.deleteSection}>
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete task</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  loading:      { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText:  { color: colors.textMuted },
  scroll:       { paddingBottom: 60 },
  title:        { ...typography.heading2, color: colors.textPrimary, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  titleInput:   { ...typography.heading2, color: colors.textPrimary, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  section:      { paddingHorizontal: 16, paddingTop: 20 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  label:        { ...typography.caption, color: colors.textMuted, fontWeight: '600', width: 70, letterSpacing: 0.5 },
  value:        { ...typography.body, color: colors.textPrimary },
  priorityRow:  { flexDirection: 'row', gap: 8, marginTop: 10 },
  priorityBtn:  { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  priorityBtnText: { fontWeight: '600', fontSize: 13 },
  deleteSection:{ paddingHorizontal: 16, paddingTop: 40 },
  deleteBtn:    { paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.error },
  deleteText:   { color: colors.error, fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 2: Verify task detail opens from Inbox**

Tap a task row in Inbox. Expected: navigates to Task Detail showing the task title, priority picker, and sub-tasks section.

- [ ] **Step 3: Verify inline title editing**

Tap the task title. Expected: becomes a TextInput. Edit text. Tap Done on keyboard. Expected: title updates in the list immediately (reactive via PowerSync).

- [ ] **Step 4: Verify priority change**

Tap P1 on the priority picker. Expected: P1 button fills with red. Go back — the task row shows a P1 badge.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/TaskDetailScreen.tsx
git commit -m "feat(mobile): implement TaskDetail with inline editing, priority picker, sub-tasks, delete"
```

---

## Task 7: Project screen and project management

**Files:**
- Modify: `apps/mobile/src/screens/ProjectScreen.tsx` (replace placeholder)
- Create: `apps/mobile/src/components/CreateProjectModal.tsx`

- [ ] **Step 1: Create apps/mobile/src/components/CreateProjectModal.tsx**

```typescript
import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { usePowerSync } from '@powersync/react';
import { createProject } from '@todolist/db';
import { useAuth }       from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';

const COLORS = ['#6366F1','#EF4444','#F97316','#22C55E','#3B82F6','#EC4899','#F59E0B'];
const ICONS  = ['📁','⭐','🏠','💼','🎯','📚','🏋️','🛒','💡'];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ visible, onClose }: Props) {
  const db          = usePowerSync();
  const { session } = useAuth();
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon,  setIcon]  = useState(ICONS[0]);

  const handleCreate = async () => {
    if (!name.trim() || !session) return;
    await createProject(db as any, { userId: session.user.id, name: name.trim(), color, icon });
    setName(''); setColor(COLORS[0]); setIcon(ICONS[0]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.handle} />
        <Text style={styles.heading}>New project</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Project name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Text style={styles.label}>Color</Text>
        <View style={styles.swatches}>
          {COLORS.map(c => (
            <Pressable
              key={c}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        <Text style={styles.label}>Icon</Text>
        <View style={styles.icons}>
          {ICONS.map(i => (
            <Pressable
              key={i}
              style={[styles.iconBtn, icon === i && styles.iconBtnSelected]}
              onPress={() => setIcon(i)}
            >
              <Text style={{ fontSize: 22 }}>{i}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.createBtn, !name.trim() && styles.disabled]}
            onPress={handleCreate}
            disabled={!name.trim()}
          >
            <Text style={styles.createText}>Create</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet:          { flex: 1, backgroundColor: colors.surfaceAlt ?? '#1C1C1C', paddingHorizontal: 20, paddingTop: 12 },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  heading:        { ...typography.heading2, color: colors.textPrimary, marginBottom: 20 },
  label:          { ...typography.caption, color: colors.textMuted, fontWeight: '600', marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  input:          { ...typography.body, color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  swatches:       { flexDirection: 'row', gap: 10 },
  swatch:         { width: 32, height: 32, borderRadius: 16 },
  swatchSelected: { borderWidth: 3, borderColor: '#fff' },
  icons:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn:        { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  iconBtnSelected:{ borderColor: colors.accent, backgroundColor: colors.surface },
  actions:        { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText:     { color: colors.textSecondary, fontWeight: '500' },
  createBtn:      { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' },
  disabled:       { opacity: 0.4 },
  createText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 2: Replace ProjectScreen.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePowerSync } from '@powersync/react';
import { useProjectTasks, completeTask, updateTaskDue } from '@todolist/db';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow }   from '../components/SwipeableTaskRow';
import { QuickCaptureModal }  from '../components/QuickCaptureModal';
import { FAB }                from '../components/FAB';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { AppDrawerParamList } from '../navigation/AppDrawer';

type Props = DrawerScreenProps<AppDrawerParamList, 'Project'>;

export function ProjectScreen({ route, navigation }: Props) {
  const { id, name } = route.params;
  const db           = usePowerSync();
  const { data: tasks } = useProjectTasks(id);
  const [captureOpen, setCaptureOpen] = useState(false);

  const handleComplete = useCallback(async (taskId: string) => {
    await completeTask(db as any, taskId);
  }, [db]);

  const handleReschedule = useCallback(async (taskId: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    await updateTaskDue(db as any, taskId, d.toISOString().split('T')[0], null);
  }, [db]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.title}>{name}</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyBody}>Tap + to add a task to this project</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <SwipeableTaskRow
              task={item as any}
              onPress={taskId => navigation.navigate('Main', { screen: 'InboxStack', params: { screen: 'TaskDetail', params: { id: taskId } } })}
              onComplete={handleComplete}
              onReschedule={handleReschedule}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <FAB onPress={() => setCaptureOpen(true)} />
      <QuickCaptureModal
        visible={captureOpen}
        projectId={id}
        onClose={() => setCaptureOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuBtn:   { marginRight: 12 },
  menuIcon:  { color: colors.textSecondary, fontSize: 20 },
  title:     { ...typography.heading3, color: colors.textPrimary },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.heading3, color: colors.textPrimary, marginBottom: 8 },
  emptyBody:  { ...typography.body, color: colors.textMuted },
});
```

- [ ] **Step 3: Add "New project" button to AppDrawer**

In `apps/mobile/src/navigation/AppDrawer.tsx`, add CreateProjectModal import and a button below the project list:

```typescript
// Add to imports:
import { CreateProjectModal } from '../components/CreateProjectModal';

// Add inside DrawerContent function, before the return:
const [createOpen, setCreateOpen] = React.useState(false);

// Add in JSX, after the projects list and before the sign-out block:
<Pressable
  style={{ paddingHorizontal: 16, paddingVertical: 10 }}
  onPress={() => setCreateOpen(true)}
>
  <Text style={{ color: colors.accent, fontSize: 14 }}>+ New project</Text>
</Pressable>
<CreateProjectModal visible={createOpen} onClose={() => setCreateOpen(false)} />
```

- [ ] **Step 4: Verify project flow**

Open drawer → tap "+ New project" → fill in name + pick color + icon → tap Create.
Expected: project appears in drawer list immediately.

Tap the project → ProjectScreen opens → tap FAB → QuickCaptureModal → type a task → Add task.
Expected: task appears in project task list.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/ProjectScreen.tsx apps/mobile/src/components/CreateProjectModal.tsx apps/mobile/src/navigation/AppDrawer.tsx
git commit -m "feat(mobile): implement Project screen and CreateProjectModal"
```

---

## Task 8: Sync status indicator

**Files:**
- Create: `apps/mobile/src/hooks/useSyncStatus.ts`
- Modify: `apps/mobile/src/navigation/AppTabs.tsx` — add sync indicator to header

- [ ] **Step 1: Create apps/mobile/src/hooks/useSyncStatus.ts**

```typescript
import { useEffect, useState } from 'react';
import { usePowerSync }        from '@powersync/react';

export type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function useSyncStatus(): { status: SyncStatus; lastSyncedAt: Date | null } {
  const db                  = usePowerSync();
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => {
      const syncStatus = db.currentStatus;

      if (!syncStatus.connected) {
        setStatus('offline');
        return;
      }

      if (syncStatus.dataFlowStatus?.downloading) {
        setStatus('syncing');
        return;
      }

      const lastSync = syncStatus.lastSyncedAt
        ? new Date(syncStatus.lastSyncedAt)
        : null;

      setLastSyncedAt(lastSync);

      if (lastSync && Date.now() - lastSync.getTime() > STALE_THRESHOLD_MS) {
        setStatus('stale');
      } else {
        setStatus('synced');
      }
    };

    update();
    const unsub = db.registerListener({ statusChanged: update });
    return () => unsub();
  }, [db]);

  return { status, lastSyncedAt };
}
```

- [ ] **Step 2: Add SyncStatusIndicator to the Inbox header**

In `apps/mobile/src/screens/InboxScreen.tsx`, add to the screen options via `navigation.setOptions` in a `useEffect`:

```typescript
// Add imports:
import { useSyncStatus } from '../hooks/useSyncStatus';
import { SyncStatusIndicator } from '@todolist/ui';

// Add inside InboxScreen component:
const { status, lastSyncedAt } = useSyncStatus();

useEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <SyncStatusIndicator status={status} lastSyncedAt={lastSyncedAt} />
    ),
  });
}, [navigation, status, lastSyncedAt]);
```

- [ ] **Step 3: Verify sync indicator**

Run the app connected. Expected: green dot + "Synced HH:MM" in Inbox header.

Turn off network (Airplane mode in simulator). Expected: dot turns red + "Offline".

Turn network back on. Expected: briefly shows "Syncing…" then returns to green.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useSyncStatus.ts apps/mobile/src/screens/InboxScreen.tsx
git commit -m "feat(mobile): add sync status indicator to Inbox header"
```

---

## Task 9: Detox E2E setup and golden-path test

**Files:**
- Create: `apps/mobile/.detoxrc.js`
- Create: `apps/mobile/e2e/jest.config.js`
- Create: `apps/mobile/e2e/golden-path.test.ts`

- [ ] **Step 1: Install Detox**

```bash
pnpm --filter @todolist/mobile add --save-dev detox @types/detox jest jest-circus
```

- [ ] **Step 2: Create apps/mobile/.detoxrc.js**

```js
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { '$0': 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 120000 },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/TodoList.app',
      build: 'xcodebuild -workspace ios/TodoList.xcworkspace -scheme TodoList -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 15' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'Pixel_6_API_34' },
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
  },
};
```

- [ ] **Step 3: Create apps/mobile/e2e/jest.config.js**

```js
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
```

- [ ] **Step 4: Create apps/mobile/e2e/golden-path.test.ts**

```typescript
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

// Test account must exist in Supabase — set via env vars
const TEST_EMAIL    = process.env.TEST_EMAIL    ?? 'e2e@test.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'E2eTestPass123!';

describe('Golden path', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows login screen on fresh launch', async () => {
    await detoxExpect(element(by.text('Welcome back'))).toBeVisible();
  });

  it('signs in with valid credentials', async () => {
    await element(by.placeholder('you@example.com')).typeText(TEST_EMAIL);
    await element(by.placeholder('••••••••••••')).typeText(TEST_PASSWORD);
    await element(by.text('Sign in')).tap();

    // After sign-in, Inbox tab should become visible
    await waitFor(element(by.text('Inbox'))).toBeVisible().withTimeout(10000);
  });

  it('creates a task via quick capture with NLP', async () => {
    // Tap the FAB
    await element(by.label('Add task')).tap();

    // Type in the quick capture input
    await waitFor(element(by.text('New task'))).toBeVisible().withTimeout(3000);
    await element(by.placeholder('What needs to be done?')).typeText('Golden path task p2');

    // Submit
    await element(by.text('Add task')).tap();

    // Task should appear in the list
    await waitFor(element(by.text('Golden path task'))).toBeVisible().withTimeout(5000);
  });

  it('opens task detail when tapping a task', async () => {
    await element(by.text('Golden path task')).tap();
    await waitFor(element(by.text('Golden path task'))).toBeVisible().withTimeout(3000);

    // Priority picker should be visible
    await detoxExpect(element(by.text('P2'))).toBeVisible();
  });

  it('completes a task by swiping left', async () => {
    await device.pressBack(); // go back to Inbox (Android) / navigate back (iOS)
    await element(by.text('Golden path task')).swipe('left', 'slow', 0.75);
    // Task should disappear from the list after completion
    await waitFor(element(by.text('Golden path task'))).not.toBeVisible().withTimeout(3000);
  });

  it('signs out cleanly', async () => {
    // Open drawer
    await element(by.text('Inbox')).swipe('right', 'slow', 0.3);
    await waitFor(element(by.text('Sign out'))).toBeVisible().withTimeout(3000);
    await element(by.text('Sign out')).tap();

    // Should return to login
    await waitFor(element(by.text('Welcome back'))).toBeVisible().withTimeout(5000);
  });
});
```

- [ ] **Step 5: Build the iOS app for Detox**

```bash
cd apps/mobile
npx detox build --configuration ios.sim.debug
```

Expected: Xcode build succeeds. Binary exists at `ios/build/Build/Products/Debug-iphonesimulator/TodoList.app`.

- [ ] **Step 6: Create E2E test user in Supabase**

In Supabase dashboard → Authentication → Users → Add user:
- Email: `e2e@test.com`
- Password: `E2eTestPass123!`

- [ ] **Step 7: Run the E2E tests**

```bash
cd apps/mobile
TEST_EMAIL=e2e@test.com TEST_PASSWORD=E2eTestPass123! npx detox test --configuration ios.sim.debug
```

Expected:
```
Golden path
  ✓ shows login screen on fresh launch (XXXms)
  ✓ signs in with valid credentials (XXXms)
  ✓ creates a task via quick capture with NLP (XXXms)
  ✓ opens task detail when tapping a task (XXXms)
  ✓ completes a task by swiping left (XXXms)
  ✓ signs out cleanly (XXXms)

6 passing
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/e2e/ apps/mobile/.detoxrc.js
git commit -m "test(mobile): add Detox E2E golden-path test (sign in, capture, complete, sign out)"
```

---

## Completion Checklist

Before declaring Phase 1C (and all of Phase 1) done, verify:

- [ ] `pnpm test` still passes — 12 NLP parser unit tests green
- [ ] Inbox screen shows live tasks from PowerSync, updates within 5s of a Supabase insert
- [ ] Swipe left → task fades out and is marked completed in Supabase
- [ ] FAB → QuickCaptureModal → "Buy milk p1 tomorrow" → task created with P1 and tomorrow's date
- [ ] Tapping a task → TaskDetail shows title, priority picker, sub-tasks
- [ ] Inline title edit saves on blur
- [ ] Adding a sub-task → appears immediately below parent in TaskDetail
- [ ] Today screen shows tasks due today + overdue section
- [ ] Upcoming screen groups tasks by date for next 7 days
- [ ] Drawer → "+ New project" → creates project, appears in drawer
- [ ] Project screen shows tasks in that project; FAB captures to that project
- [ ] Sync indicator: green when online, red when offline, amber after 5 min stale
- [ ] Detox E2E golden path: 6/6 tests passing
