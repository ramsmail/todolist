import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  title: string;
  created_at: string;
}

export default function CaptureScreen() {
  const { session, loading: authLoading, signOut } = useAuth();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .is('deleted_at', null)
      // Match the web inbox: hide completed/cancelled tasks (status is set, not
      // deleted_at, when a task is completed — so deleted_at IS NULL isn't enough)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) console.warn('[tasks] fetch', error.message);
    else setTasks(data ?? []);
    setLoadingTasks(false);
  }, []);

  useEffect(() => {
    if (session) fetchTasks();
  }, [session, fetchTasks]);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;

  const capture = async () => {
    const title = input.trim();
    if (!title) return;
    setSaving(true);
    // optimistic clear
    setInput('');
    const { error } = await supabase.from('tasks').insert({ title, status: 'inbox' });
    if (error) {
      Alert.alert('Could not save', error.message);
      setInput(title); // restore on failure
    } else {
      await fetchTasks();
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Capture</Text>
          <Text style={styles.subtitle}>Ideas · links · URLs</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={10}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.captureBox}>
        <TextInput
          style={styles.input}
          placeholder="Paste a link or jot an idea…"
          placeholderTextColor="#666"
          value={input}
          onChangeText={setInput}
          multiline
          autoCapitalize="sentences"
          editable={!saving}
        />
        <Pressable
          style={[styles.btn, (!input.trim() || saving) && styles.btnDisabled]}
          onPress={capture}
          disabled={!input.trim() || saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Capture</Text>}
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Recent</Text>
      {loadingTasks ? (
        <ActivityIndicator color="#6366F1" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          onRefresh={fetchTasks}
          refreshing={false}
          contentContainerStyle={tasks.length === 0 && styles.emptyWrap}
          ListEmptyComponent={<Text style={styles.empty}>Nothing yet — capture something above.</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.itemText}>{item.title}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  center: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  title: { fontSize: 30, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },
  signOut: { color: '#6366F1', fontSize: 14, marginTop: 6 },
  captureBox: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  input: {
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10,
    padding: 14, color: '#fff', minHeight: 70, fontSize: 15, marginBottom: 12, textAlignVertical: 'top',
  },
  btn: { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
  },
  item: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#141414' },
  itemText: { color: '#eaeaea', fontSize: 15, lineHeight: 21 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  empty: { color: '#555', fontSize: 14 },
});
