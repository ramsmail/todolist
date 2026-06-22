# Phase 2B — Labels & Recurrence (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring labels and recurring tasks to the Expo mobile app, consuming the shared `packages/core` and `packages/db` work delivered in the web plan.

**Architecture:** The recurrence engine, NLP recurrence parsing, the PowerSync `labels` table, label CRUD, and the recurrence-aware `completeTask` already exist in the shared packages. This plan adds React Native UI: a shared `LabelChip` in `packages/ui`, an RN `RecurrencePicker`, a Labels section in the drawer, a per-label screen, a Manage Labels screen, a Repeat row in the task detail screen, label chips + recurring badge on rows, and recurrence/`ensureLabels` wiring in mobile quick capture.

**Tech Stack:** React Native (Expo), React Navigation (drawer + native-stack + bottom-tabs), NativeWind/StyleSheet, `@todolist/core`, `@todolist/db`, `@todolist/ui`.

**Prerequisite:** The web plan (`2026-06-23-phase2b-labels-recurrence-web.md`), Phases A & B (shared `core` + `db`), must be merged or present on the branch. This plan imports `useLabels`, `useTasksByLabel`, `createLabel`, `updateLabel`, `deleteLabel`, `ensureLabels`, `updateTaskRecurrence`, `parseRule`, `serializeRule`, `describeRule`, `WD_ORDER`, and `NlpParseResult.recurrenceRule` from those packages.

**Companion spec:** `docs/superpowers/specs/2026-06-23-phase2b-labels-recurrence-design.md`

**Note on testing:** The mobile app has no unit-test harness (only a Detox-style `e2e/golden-path.e2e.ts`). Mobile UI tasks below verify via `tsc --noEmit` type-checks and manual smoke; the shared logic is already unit-tested in the web plan. Do not invent `vitest`/`jest` commands for `apps/mobile`.

---

## File Structure

**`packages/ui`**
- Create `src/LabelChip.tsx` — RN colored chip.
- Modify `src/index.ts` — export `LabelChip`.

**`apps/mobile`**
- Create `src/components/RecurrencePicker.tsx` — RN preset + custom picker.
- Modify `src/navigation/AppDrawer.tsx` — Labels section; register `Label` + `ManageLabels` screens; extend param list.
- Create `src/screens/LabelScreen.tsx` — per-label filtered list.
- Create `src/screens/ManageLabelsScreen.tsx` — create/edit/delete labels.
- Modify `src/screens/TaskDetailScreen.tsx` — Repeat row.
- Modify `src/components/SwipeableTaskRow.tsx` — label chips + recurring badge.
- Modify `src/components/QuickCaptureModal.tsx` — `ensureLabels` + `recurrenceRule`.

---

### Task 1: Shared LabelChip in packages/ui

**Files:**
- Create: `packages/ui/src/LabelChip.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the component**

```tsx
// packages/ui/src/LabelChip.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  name:  string;
  color: string;
}

export function LabelChip({ name, color }: Props) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}1a` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, gap: 5 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '500' },
});
```

- [ ] **Step 2: Export it**

```ts
// packages/ui/src/index.ts — add this line near the other component exports
export { LabelChip } from './LabelChip';
```

- [ ] **Step 3: Build the package**

Run: `pnpm --filter @todolist/ui build`
Expected: `tsc` exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/LabelChip.tsx packages/ui/src/index.ts
git commit -m "feat(ui): shared LabelChip component"
```

---

### Task 2: RN RecurrencePicker

**Files:**
- Create: `apps/mobile/src/components/RecurrencePicker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/components/RecurrencePicker.tsx
import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { parseRule, serializeRule, describeRule, WD_ORDER, type Weekday, type Freq } from '@todolist/core';
import { colors, typography } from '@todolist/ui';

interface Props {
  value:    string | null;
  onChange: (rule: string | null) => void;
}

const PRESETS: Array<{ label: string; value: string | null }> = [
  { label: 'None',    value: null },
  { label: 'Daily',   value: 'FREQ=DAILY' },
  { label: 'Weekday', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly',  value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Yearly',  value: 'FREQ=YEARLY' },
];

const WD_LABEL: Record<Weekday, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'T', FR: 'F', SA: 'S', SU: 'S',
};

export function RecurrencePicker({ value, onChange }: Props) {
  const rule = value ? parseRule(value) : null;

  const setInterval = (text: string) => {
    const n = parseInt(text, 10);
    if (!rule || !Number.isFinite(n) || n < 1) return;
    onChange(serializeRule({ ...rule, interval: n }));
  };
  const toggleDay = (d: Weekday) => {
    if (!rule || rule.freq !== 'weekly') return;
    const cur = rule.byDay ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    onChange(serializeRule({ ...rule, byDay: WD_ORDER.filter((x) => next.includes(x)) }));
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {PRESETS.map((p) => {
          const active = (p.value ?? null) === (value ?? null);
          return (
            <Pressable
              key={p.label}
              onPress={() => onChange(p.value)}
              style={[styles.preset, active && styles.presetActive]}
            >
              <Text style={[styles.presetText, active && styles.presetTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {rule && (
        <View style={styles.custom}>
          <View style={styles.intervalRow}>
            <Text style={styles.label}>Every</Text>
            <TextInput
              style={styles.intervalInput}
              keyboardType="number-pad"
              defaultValue={String(rule.interval)}
              onEndEditing={(e) => setInterval(e.nativeEvent.text)}
            />
            <Text style={styles.label}>
              {rule.freq === 'daily' ? 'day(s)' : rule.freq === 'weekly' ? 'week(s)'
                : rule.freq === 'monthly' ? 'month(s)' : 'year(s)'}
            </Text>
          </View>

          {rule.freq === 'weekly' && (
            <View style={styles.days}>
              {WD_ORDER.map((d) => {
                const on = rule.byDay?.includes(d) ?? false;
                return (
                  <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, on && styles.dayOn]}>
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{WD_LABEL[d]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.summary}>{describeRule(rule)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  presets:        { gap: 8, paddingVertical: 4 },
  preset:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  presetActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  presetText:     { ...typography.caption, color: colors.textSecondary, fontSize: 13 },
  presetTextActive:{ color: '#fff' },
  custom:         { marginTop: 14, gap: 12 },
  intervalRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label:          { ...typography.body, color: colors.textSecondary },
  intervalInput:  { width: 56, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 6, textAlign: 'center' },
  days:           { flexDirection: 'row', gap: 6 },
  day:            { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dayOn:          { backgroundColor: colors.accent },
  dayText:        { color: colors.textSecondary, fontSize: 13 },
  dayTextOn:      { color: '#fff', fontWeight: '600' },
  summary:        { ...typography.caption, color: colors.textMuted },
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/RecurrencePicker.tsx
git commit -m "feat(mobile): RN RecurrencePicker"
```

---

### Task 3: Drawer Labels section + screen registration

**Files:**
- Modify: `apps/mobile/src/navigation/AppDrawer.tsx`

- [ ] **Step 1: Extend the param list and imports**

Replace the param list and add imports:

```tsx
import { useProjects, useLabels } from '@todolist/db';
import { ProjectScreen }      from '../screens/ProjectScreen';
import { LabelScreen }        from '../screens/LabelScreen';
import { ManageLabelsScreen } from '../screens/ManageLabelsScreen';

export type AppDrawerParamList = {
  Main:         undefined;
  Project:      { id: string; name: string };
  Label:        { name: string };
  ManageLabels: undefined;
};
```

- [ ] **Step 2: Read labels in `DrawerContent`** (next to `useProjects`)

```tsx
  const { data: labels } = useLabels();
```

- [ ] **Step 3: Add the Labels section** (immediately after the Projects `View` block, before the bottom `Sign out` `View`)

```tsx
      <View style={{ marginTop: 8 }}>
        <Text style={{
          color: colors.textMuted, fontSize: 11, fontWeight: '600',
          paddingHorizontal: 16, paddingBottom: 8, letterSpacing: 0.8,
        }}>
          LABELS
        </Text>
        {labels && labels.map((l) => (
          <Pressable
            key={l.id}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
            onPress={() => nav.navigate('Label', { name: l.name })}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color ?? colors.accent, marginRight: 10 }} />
            <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{l.name}</Text>
          </Pressable>
        ))}
        <Pressable
          style={{ paddingHorizontal: 16, paddingVertical: 10 }}
          onPress={() => nav.navigate('ManageLabels')}
        >
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '500' }}>+ Manage labels</Text>
        </Pressable>
      </View>
```

- [ ] **Step 4: Register the two screens** (next to the hidden `Project` screen in `AppDrawer`)

```tsx
      <Drawer.Screen name="Label"        component={LabelScreen}        options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="ManageLabels" component={ManageLabelsScreen} options={{ drawerItemStyle: { display: 'none' }, headerShown: true, title: 'Manage labels', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
```

- [ ] **Step 5: Type-check** (will fail until Tasks 4 & 5 create the screens; that's expected — proceed to those, then re-run)

Run: `pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: errors only about missing `LabelScreen`/`ManageLabelsScreen` modules.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/navigation/AppDrawer.tsx
git commit -m "feat(mobile): drawer Labels section + screen registration"
```

---

### Task 4: LabelScreen (per-label filtered list)

**Files:**
- Create: `apps/mobile/src/screens/LabelScreen.tsx`

- [ ] **Step 1: Write the screen** (mirrors `ProjectScreen`)

```tsx
// apps/mobile/src/screens/LabelScreen.tsx
import React, { useCallback } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTasksByLabel, completeTask, updateTaskDue } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { colors, typography } from '@todolist/ui';
import { SwipeableTaskRow, type TaskRowData } from '../components/SwipeableTaskRow';
import type { AppDrawerParamList } from '../navigation/AppDrawer';

type RouteProps = RouteProp<AppDrawerParamList, 'Label'>;

export function LabelScreen() {
  const db    = usePowerSync();
  const route = useRoute<RouteProps>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav   = useNavigation<any>();
  const { name } = route.params;

  const { data: tasks } = useTasksByLabel(name);

  const handleComplete = useCallback((id: string) => {
    completeTask(db as any, id).catch(console.error);
  }, [db]);

  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
  }, [db]);

  const handlePress = useCallback((taskId: string) => {
    nav.navigate('Main', {
      screen: 'InboxStack',
      params: { screen: 'TaskDetail', params: { taskId } },
    });
  }, [nav]);

  const renderItem = useCallback(({ item }: { item: TaskRowData }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
    />
  ), [handlePress, handleComplete, handleReschedule]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>@{name}</Text>
        <Text style={styles.count}>{tasks?.length ?? 0}</Text>
      </View>
      <FlatList
        data={tasks ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={tasks?.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>No tasks with this label.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title:          { ...typography.heading1, color: colors.textPrimary, flex: 1 },
  count:          { ...typography.caption, color: colors.textMuted, fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:          { ...typography.body, color: colors.textMuted, marginTop: 80, textAlign: 'center' },
});
```

`useTasksByLabel` returns rows including `labels` and `recurrence_rule`, which satisfy the extended `TaskRowData` from Task 7.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/screens/LabelScreen.tsx
git commit -m "feat(mobile): per-label task screen"
```

---

### Task 5: ManageLabelsScreen

**Files:**
- Create: `apps/mobile/src/screens/ManageLabelsScreen.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// apps/mobile/src/screens/ManageLabelsScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePowerSync } from '@powersync/react';
import { useLabels, createLabel, updateLabel, deleteLabel, type LabelRecord } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

export function ManageLabelsScreen() {
  const db          = usePowerSync();
  const { session } = useAuth();
  const { data: labels } = useLabels();
  const [newName, setNewName] = useState('');

  const create = useCallback(async () => {
    const name = newName.trim().toLowerCase();
    if (!name || !session) return;
    await createLabel(db as any, { userId: session.user.id, name }).catch(console.error);
    setNewName('');
  }, [db, newName, session]);

  const confirmDelete = useCallback((l: LabelRecord) => {
    Alert.alert('Delete label', `Delete "${l.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLabel(db as any, l.id).catch(console.error) },
    ]);
  }, [db]);

  const renderItem = useCallback(({ item: l }: { item: LabelRecord }) => (
    <View style={styles.row}>
      <View style={styles.swatches}>
        {SWATCHES.map((c) => (
          <Pressable
            key={c}
            onPress={() => updateLabel(db as any, l.id, { color: c }).catch(console.error)}
            style={[styles.swatch, { backgroundColor: c }, l.color === c && styles.swatchActive]}
          />
        ))}
      </View>
      <TextInput
        style={styles.name}
        defaultValue={l.name}
        onEndEditing={(e) => {
          const v = e.nativeEvent.text.trim().toLowerCase();
          if (v && v !== l.name) updateLabel(db as any, l.id, { name: v }).catch(console.error);
        }}
      />
      <Pressable onPress={() => confirmDelete(l)} hitSlop={10}>
        <Text style={styles.delete}>✕</Text>
      </Pressable>
    </View>
  ), [db, confirmDelete]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="New label name"
          placeholderTextColor={colors.textMuted}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={create}
          returnKeyType="done"
        />
        <Pressable style={styles.addBtn} onPress={create}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={labels ?? []}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No labels yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg, padding: 16 },
  addRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addInput:     { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, paddingHorizontal: 14, paddingVertical: 10 },
  addBtn:       { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnText:   { color: '#fff', fontWeight: '600' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  swatches:     { flexDirection: 'row', gap: 4 },
  swatch:       { width: 16, height: 16, borderRadius: 8 },
  swatchActive: { borderWidth: 2, borderColor: '#fff' },
  name:         { flex: 1, color: colors.textPrimary, ...typography.body },
  delete:       { color: colors.textMuted, fontSize: 16 },
  empty:        { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 60 },
});
```

- [ ] **Step 2: Type-check (AppDrawer + both screens now resolve)**

Run: `pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/ManageLabelsScreen.tsx
git commit -m "feat(mobile): Manage Labels screen"
```

---

### Task 6: TaskDetailScreen — Repeat row

**Files:**
- Modify: `apps/mobile/src/screens/TaskDetailScreen.tsx`

- [ ] **Step 1: Add imports**

Add `updateTaskRecurrence` to the `@todolist/db` import and import the picker:

```tsx
import {
  useTask, updateTaskTitle, updateTaskPriority,
  deleteTask, completeTask, updateTaskRecurrence,
} from '@todolist/db';
import { RecurrencePicker } from '../components/RecurrencePicker';
```

- [ ] **Step 2: Add a handler** (next to `handlePriority`)

```tsx
  const handleRecurrence = useCallback(async (rule: string | null) => {
    const start = rule ? (task?.due_date ?? new Date().toISOString().split('T')[0]) : null;
    await updateTaskRecurrence(db as any, taskId, rule, start).catch(console.error);
  }, [db, taskId, task?.due_date]);
```

- [ ] **Step 3: Add the Repeat section** (immediately after the Due date `View` block)

```tsx
        {/* Repeat */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REPEAT</Text>
          <RecurrencePicker value={task.recurrence_rule ?? null} onChange={handleRecurrence} />
        </View>
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/TaskDetailScreen.tsx
git commit -m "feat(mobile): recurrence picker in task detail"
```

---

### Task 7: SwipeableTaskRow — label chips + recurring badge

**Files:**
- Modify: `apps/mobile/src/components/SwipeableTaskRow.tsx`

- [ ] **Step 1: Extend `TaskRowData` and imports**

```tsx
import { TaskCheckbox, PriorityBadge, LabelChip, colors, typography } from '@todolist/ui';
import { useLabels } from '@todolist/db';

export interface TaskRowData {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
  labels?:  string | null;          // JSON string array of names
  recurrence_rule?: string | null;
}
```

- [ ] **Step 2: Derive label colors + names inside the component** (top of `SwipeableTaskRow`, after the existing hooks)

```tsx
  const { data: allLabels } = useLabels();
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];
  const colorOf = (n: string) => allLabels?.find((l) => l.name === n)?.color ?? colors.p4;
```

- [ ] **Step 3: Render chips + badge** (inside the content `Pressable`, after the title `Text`, before the due-date `Text`)

```tsx
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          {(names.length > 0 || task.recurrence_rule) && (
            <View style={styles.meta}>
              {task.recurrence_rule && <Text style={styles.recur}>↻</Text>}
              {names.map((n) => <LabelChip key={n} name={n} color={colorOf(n)} />)}
            </View>
          )}
```

- [ ] **Step 4: Add styles** (in the `StyleSheet.create` block)

```tsx
  meta:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  recur: { color: colors.textMuted, fontSize: 13 },
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/SwipeableTaskRow.tsx
git commit -m "feat(mobile): label chips + recurring badge on rows"
```

---

### Task 8: QuickCaptureModal — ensureLabels + recurrence

**Files:**
- Modify: `apps/mobile/src/components/QuickCaptureModal.tsx`

- [ ] **Step 1: Update the import**

```tsx
import { createTask, ensureLabels } from '@todolist/db';
```

- [ ] **Step 2: Wire it into `handleSave`** (replace the `parsed`/`createTask` block)

```tsx
      const parsed = parseTaskInput(trimmed, { now: new Date() });
      if (parsed.labels.length) await ensureLabels(db as any, session.user.id, parsed.labels);
      await createTask(db as any, {
        userId:         session.user.id,
        title:          parsed.title,
        priority:       parsed.priority,
        dueDate:        parsed.dueDate,
        dueTime:        parsed.dueTime,
        timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId:      projectId ?? null,
        labels:         parsed.labels,
        recurrenceRule: parsed.recurrenceRule,
        status:         'inbox',
      });
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/QuickCaptureModal.tsx
git commit -m "feat(mobile): quick capture ensures labels + recurrence"
```

---

## Final verification

- [ ] **Type-check the whole mobile app + shared packages**

Run: `pnpm --filter @todolist/ui build && pnpm --filter @todolist/mobile exec tsc --noEmit`
Expected: both exit 0.

- [ ] **Manual smoke (device/simulator)**

Run the Expo app. Then:
1. Open Quick Capture, enter `Stand-up p2 @work every weekday 9am` → confirm the row shows a `↻` badge and a `work` chip.
2. Open the drawer → confirm `work` appears under LABELS; tap it → the per-label list shows the task.
3. Drawer → `+ Manage labels` → rename `work` to `office`, change its color, confirm the chip/list update; delete a test label.
4. Open the task → Repeat row shows "Every weekday"; switch to Weekly + pick Mon/Wed; complete the task and confirm it advances to the next occurrence (stays in the list) rather than disappearing.

- [ ] **Optional: extend the Detox e2e**

If maintaining `apps/mobile/e2e/golden-path.e2e.ts`, add a step that quick-captures a task with `@label every day` and asserts the chip + badge render. Run per the mobile app's existing e2e instructions.
```
