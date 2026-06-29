import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { session, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }
  if (session) return <Redirect href="/" />;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (e) {
      setError((e as Error).message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.title}>TodoList</Text>
          <Text style={styles.subtitle}>Capture ideas on the go</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!busy}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>{mode === 'in' ? 'Sign In' : 'Sign Up'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} disabled={busy}>
            <Text style={styles.toggle}>
              {mode === 'in' ? "No account? Sign up" : 'Have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 6, marginBottom: 32 },
  input: {
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10,
    padding: 14, marginBottom: 14, color: '#fff', fontSize: 16,
  },
  btn: { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggle: { color: '#6366F1', textAlign: 'center', marginTop: 18, fontSize: 14 },
  error: { color: '#ff5555', fontSize: 13, marginBottom: 10, textAlign: 'center' },
});
