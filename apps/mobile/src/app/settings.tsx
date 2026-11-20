import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { usePowerSync } from '@powersync/react';
import { useUserSettings, upsertUserSettings, getUserSettings } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { ensureNotificationPermission } from '../notifications/registerPushToken';
import { normalizeCheckinTime } from '../notifications/checkinContent';
import { colors, typography } from '@todolist/ui';

function parseTime(time: string | null): Date {
  const date = new Date();
  const [h, m] = (time ?? '09:00').split(':').map(Number);
  date.setHours(h, m, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

type TimeField = 'nudge_time' | 'checkin_time';

export default function SettingsScreen() {
  const db = usePowerSync();
  const router = useRouter();
  const { session } = useAuth();
  const { data: rows } = useUserSettings();
  const settings = rows?.[0] ?? null;
  const [iosPickerFor, setIosPickerFor] = useState<TimeField | null>(null);

  const userId = session?.user.id ?? '';
  const nudgeEnabled = !!settings?.nudge_enabled;
  const nudgeTime = settings?.nudge_time ?? '09:00';
  const p1CardsEnabled = !!settings?.p1_cards_enabled;
  const checkinEnabled = !!settings?.checkin_enabled;
  const checkinTime = normalizeCheckinTime(settings?.checkin_time);

  // TEMPORARY DIAGNOSTIC — tracks each handleToggle invocation to catch a
  // double-fire of Switch's onValueChange (a known Android RN issue) sending
  // conflicting values for what looks like one tap.
  const lastCallRef = useRef<{ value: boolean; at: number } | null>(null);

  const handleToggle = useCallback(async (value: boolean) => {
    const now = Date.now();
    const prevCall = lastCallRef.current;
    lastCallRef.current = { value, at: now };
    if (prevCall && now - prevCall.at < 2000) {
      Alert.alert(
        'Diagnostic: toggle fired twice',
        `handleToggle was called again ${now - prevCall.at}ms after the previous call.\nPrevious value: ${prevCall.value}\nThis value: ${value}`
      );
    }

    if (!userId) {
      Alert.alert('Not signed in', 'Your session is not ready yet — try again in a moment.');
      return;
    }
    try {
      if (value) {
        const { granted, canAskAgain } = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications disabled',
            canAskAgain
              ? 'Notification permission was not granted. Please allow notifications to use the daily inbox nudge.'
              : 'Notifications are blocked for this app. Enable them in your device Settings > Apps > TodoList > Notifications to use the daily inbox nudge.'
          );
          return;
        }
      }
      await upsertUserSettings(db as any, userId, { nudge_enabled: value ? 1 : 0, nudge_time: nudgeTime });

      // TEMPORARY DIAGNOSTIC — checks whether something undoes this write
      // shortly after it locally succeeds (e.g. a stale PowerSync download
      // re-applying an old server value), invisible to this function's own
      // try/catch since it would happen in a separate async task.
      const justWrote = await getUserSettings(db as any);
      setTimeout(async () => {
        const later = await getUserSettings(db as any);
        if ((later?.nudge_enabled ?? 0) !== (justWrote?.nudge_enabled ?? 0)) {
          Alert.alert(
            'Diagnostic: setting changed itself',
            `Right after saving, nudge_enabled was ${justWrote?.nudge_enabled}. 4 seconds later it is ${later?.nudge_enabled} with no user action.`
          );
        }
      }, 4000);
    } catch (err) {
      console.error('[settings] failed to update daily nudge setting:', err);
      Alert.alert('Something went wrong', `Could not update the daily inbox nudge setting: ${String((err as any)?.message ?? err)}`);
    }
  }, [db, userId, nudgeTime]);

  const handleP1Toggle = useCallback(async (value: boolean) => {
    if (!userId) {
      Alert.alert('Not signed in', 'Your session is not ready yet — try again in a moment.');
      return;
    }
    try {
      if (value) {
        const { granted, canAskAgain } = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications disabled',
            canAskAgain
              ? 'Notification permission was not granted. Please allow notifications to use high-priority cards.'
              : 'Notifications are blocked for this app. Enable them in your device Settings > Apps > TodoList > Notifications to use high-priority cards.'
          );
          return;
        }
      }
      await upsertUserSettings(db as any, userId, { p1_cards_enabled: value ? 1 : 0 });
    } catch (err) {
      console.error('[settings] failed to update high-priority cards setting:', err);
      Alert.alert('Something went wrong', `Could not update the high-priority cards setting: ${String((err as any)?.message ?? err)}`);
    }
  }, [db, userId]);

  const handleCheckinToggle = useCallback(async (value: boolean) => {
    if (!userId) {
      Alert.alert('Not signed in', 'Your session is not ready yet — try again in a moment.');
      return;
    }
    try {
      if (value) {
        const { granted, canAskAgain } = await ensureNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications disabled',
            canAskAgain
              ? 'Notification permission was not granted. Please allow notifications to use the daily check-in.'
              : 'Notifications are blocked for this app. Enable them in your device Settings > Apps > TodoList > Notifications to use the daily check-in.'
          );
          return;
        }
      }
      await upsertUserSettings(db as any, userId, { checkin_enabled: value ? 1 : 0 });
    } catch (err) {
      console.error('[settings] failed to update daily check-in setting:', err);
      Alert.alert('Something went wrong', `Could not update the daily check-in setting: ${String((err as any)?.message ?? err)}`);
    }
  }, [db, userId]);

  const applyTime = useCallback((field: TimeField, date: Date) => {
    if (!userId) return;
    const value = formatTime(date);
    // Explicit branches rather than a computed key: `{ [field]: value }` widens
    // to an index signature that isn't assignable to WritableFields.
    const fields = field === 'nudge_time' ? { nudge_time: value } : { checkin_time: value };
    upsertUserSettings(db as any, userId, fields).catch(console.error);
  }, [db, userId]);

  const openTimePicker = useCallback((field: TimeField) => {
    const value = parseTime(field === 'nudge_time' ? nudgeTime : checkinTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: 'time', display: 'default',
        onValueChange: (_e, selectedDate) => { if (selectedDate) applyTime(field, selectedDate); },
      });
    } else {
      setIosPickerFor(field);
    }
  }, [nudgeTime, checkinTime, applyTime]);

  const handleIosChange = useCallback((_event: unknown, selectedDate?: Date) => {
    const field = iosPickerFor;
    setIosPickerFor(null);
    if (field && selectedDate) applyTime(field, selectedDate);
  }, [iosPickerFor, applyTime]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Daily check-in</Text>
        <Switch value={checkinEnabled} onValueChange={handleCheckinToggle} />
      </View>

      {checkinEnabled && (
        <Pressable style={styles.row} onPress={() => openTimePicker('checkin_time')}>
          <Text style={styles.label}>Check-in time</Text>
          <Text style={styles.value}>{checkinTime}</Text>
        </Pressable>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Daily inbox nudge</Text>
        <Switch value={nudgeEnabled} onValueChange={handleToggle} />
      </View>

      {nudgeEnabled && (
        <Pressable style={styles.row} onPress={() => openTimePicker('nudge_time')}>
          <Text style={styles.label}>Time</Text>
          <Text style={styles.value}>{nudgeTime}</Text>
        </Pressable>
      )}

      {iosPickerFor && (
        <DateTimePicker
          value={parseTime(iosPickerFor === 'nudge_time' ? nudgeTime : checkinTime)}
          mode="time"
          display="default"
          onValueChange={handleIosChange}
          onDismiss={() => setIosPickerFor(null)}
        />
      )}

      <View style={styles.row}>
        <Text style={styles.label}>High-priority cards</Text>
        <Switch value={p1CardsEnabled} onValueChange={handleP1Toggle} />
      </View>

      {p1CardsEnabled && (
        <Text style={styles.hint}>
          Up to 3 overdue or due-today P1 tasks, delivered at {nudgeTime}.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  back: { marginBottom: 12 },
  backText: { ...typography.body, color: colors.accent, fontWeight: '600' },
  heading: { ...typography.heading1, color: colors.textPrimary, marginBottom: 20 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  label: { ...typography.body, color: colors.textPrimary },
  value: { ...typography.body, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted, paddingTop: 10 },
});
