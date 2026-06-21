import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAuth } from './AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Login failed', e.message ?? 'Unknown error');
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
        <Text className="text-white text-3xl font-bold mb-2">Welcome back</Text>
        <Text className="text-neutral-400 text-base mb-10">Sign in to your tasks</Text>

        <Text className="text-neutral-300 text-sm mb-1">Email</Text>
        <TextInput
          className="bg-[#1C1C1C] text-white rounded-xl px-4 py-3 mb-4 text-base border border-[#272727]"
          placeholder="you@example.com"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        <Text className="text-neutral-300 text-sm mb-1">Password</Text>
        <TextInput
          className="bg-[#1C1C1C] text-white rounded-xl px-4 py-3 mb-6 text-base border border-[#272727]"
          placeholder="••••••••••••"
          placeholderTextColor="#6B7280"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          className="bg-indigo-500 rounded-xl py-3.5 items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-semibold text-base">Sign in</Text>
          }
        </Pressable>

        <Pressable
          className="mt-4 items-center"
          onPress={() => navigation.navigate('Register')}
        >
          <Text className="text-neutral-400 text-sm">
            No account? <Text className="text-indigo-400">Create one</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
