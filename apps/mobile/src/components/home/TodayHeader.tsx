import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { GreetingHeader } from './GreetingHeader';
import { ProgressRing } from './ProgressRing';
import { EnergyStrip } from './EnergyStrip';
import { homeColors, homeSpace, homePriorityColor } from './homeTheme';

interface Props {
  completed: number;
  total:     number;
}

// Everything the old Home tab showed that was backed by real data, compressed
// into a list header. The static Daily Focus line, the hardcoded Focus/Habits
// rings and the "coming soon" focus button are deliberately not ported.
//
// The ratio counts dated work only (useTodayStats filters due_date <= today),
// so the caption says "due today" rather than implying it covers the undated
// P1s listed under Do First below.
export function TodayHeader({ completed, total }: Props) {
  const router = useRouter();
  const progress = total > 0 ? completed / total : 0;
  const remaining = Math.max(0, total - completed);

  const openSettings = useCallback(() => router.push('/settings'), [router]);

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <GreetingHeader />
        <Pressable
          onPress={openSettings}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Settings size={22} color={homeColors.textMuted} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.progressRow}>
          <ProgressRing
            progress={progress}
            size={44}
            strokeWidth={4}
            color={homePriorityColor[4]}
          />
          <View style={styles.progressText}>
            <Text style={styles.progressValue}>{completed} of {total} done</Text>
            <Text style={styles.progressCaption}>
              {remaining === 0 ? 'Nothing left due today' : `${remaining} still due today`}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <EnergyStrip />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: homeSpace.screen,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  card: {
    backgroundColor: homeColors.card,
    borderRadius: homeSpace.cardRadius,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 14,
    gap: 12,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressText: { flex: 1, gap: 2 },
  progressValue: { fontSize: 15, color: homeColors.textPrimary, fontWeight: '700' },
  progressCaption: { fontSize: 12, color: homeColors.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: homeColors.cardBorder },
});
