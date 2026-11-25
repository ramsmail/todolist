import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react';
import { completeTask, updateTaskDue } from '@todolist/db';

// The three handlers every task list needs. Previously copy-pasted verbatim
// into each tab screen, which meant the completeTask error-handling fix had to
// be applied three times.
export function useTaskActions() {
  const db = usePowerSync();
  const router = useRouter();

  const handlePress = useCallback((id: string) => router.push(`/task/${id}`), [router]);

  // Rethrow so the row un-hides itself; a swallowed failure here used to look
  // identical to a successful completion.
  const handleComplete = useCallback(async (id: string) => {
    try {
      await completeTask(db as any, id);
    } catch (e) {
      console.error(e);
      Alert.alert('Could not complete task', 'The change was not saved. Please try again.');
      throw e;
    }
  }, [db]);

  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
  }, [db]);

  return { handlePress, handleComplete, handleReschedule };
}
