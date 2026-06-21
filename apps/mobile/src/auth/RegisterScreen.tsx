import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAuth } from './AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AuthStack';

// Password must be ≥12 chars, contain upper, lower, digit, symbol
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirm) {
      Alert.alert('Error', 'Fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      Alert.alert(
        'Weak password',
        'Password must be at least 12 characters and include upper case, lower case, a number, and a symbol.'
      );
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      Alert.alert('Check your email', 'We sent a confirmation link. Confirm it, then sign in.');
      navigation.navigate('Login');
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#0A0A0A]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-white text-3xl font-bold mb-2">Create account</Text>
        <Text className="text-neutral-400 text-base mb-10">Start managing your tasks</Text>

        <Text className="text-neutral-300 text-sm mb-1">Email</Text>
        <TextInput
          className="bg-[#1C1C1C] text-white rounded-xl px-4 py-3 mb-4 text-base border border-[#272727]"
          placeholder="you@example.com"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text className="text-neutral-300 text-sm mb-1">Password</Text>
        <TextInput
          className="bg-[#1C1C1C] text-white rounded-xl px-4 py-3 mb-4 text-base border border-[#272727]"
          placeholder="12+ chars, mixed case, number, symbol"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text className="text-neutral-300 text-sm mb-1">Confirm password</Text>
        <TextInput
          className="bg-[#1C1C1C] text-white rounded-xl px-4 py-3 mb-6 text-base border border-[#272727]"
          placeholder="••••••••••••"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <Pressable
          className="bg-indigo-500 rounded-xl py-3.5 items-center"
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-semibold text-base">Create account</Text>
          }
        </Pressable>

        <Pressable className="mt-4 items-center" onPress={() => navigation.navigate('Login')}>
          <Text className="text-neutral-400 text-sm">
            Already have an account? <Text className="text-indigo-400">Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
