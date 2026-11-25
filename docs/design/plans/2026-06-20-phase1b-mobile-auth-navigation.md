# Phase 1B — Mobile Auth & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Expo mobile app with Supabase auth (login/register screens, SecureStore token storage), PowerSync initialization, and the full navigation skeleton (bottom tabs + project drawer) so the app launches, authenticates, and syncs — with empty screens ready for content.

**Architecture:** Expo SDK 52+ with NativeWind v5 for styling. Auth state managed by AuthContext (Supabase session). PowerSync connects only when a session exists and disconnects on logout. React Navigation provides a bottom tab bar (Inbox, Today, Upcoming, Search) with a slide-out drawer for projects. Screens are empty placeholders until Plan 1C fills them.

**Tech Stack:** Expo SDK 52, React Navigation 6, NativeWind v5, @powersync/react-native, @supabase/supabase-js, expo-secure-store, expo-router (file-based routing NOT used — we use React Navigation for control over drawer/tab nesting)

**Prerequisite:** Plan 1A must be complete — `packages/core`, `packages/db`, `packages/ui` all build cleanly.

---

## File Map

```
apps/mobile/
├── package.json
├── app.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env                          # gitignored — copy from root .env.example
├── src/
│   ├── supabase/
│   │   └── client.ts             # Supabase JS client with SecureStore adapter
│   ├── auth/
│   │   ├── AuthContext.tsx       # session state, signIn, signUp, signOut
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   ├── powersync/
│   │   ├── database.ts           # PowerSyncDatabase singleton
│   │   ├── SupabaseConnector.ts  # fetchCredentials + uploadData
│   │   └── PowerSyncProvider.tsx # connects/disconnects on session change
│   ├── navigation/
│   │   ├── RootNavigator.tsx     # Auth stack vs App tabs
│   │   ├── AuthStack.tsx
│   │   ├── AppDrawer.tsx         # slide-out project drawer wrapping AppTabs
│   │   └── AppTabs.tsx           # bottom tab bar
│   └── screens/
│       ├── InboxScreen.tsx       # placeholder
│       ├── TodayScreen.tsx       # placeholder
│       ├── UpcomingScreen.tsx    # placeholder
│       ├── SearchScreen.tsx      # placeholder
│       └── ProjectScreen.tsx     # placeholder
```

---

## Task 1: Expo app bootstrap

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/tailwind.config.js`

- [ ] **Step 1: Create apps/mobile/package.json**

```json
{
  "name": "@todolist/mobile",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.tsx",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "@powersync/react": "^1.4.0",
    "@powersync/react-native": "^1.7.0",
    "@react-navigation/bottom-tabs": "^6.5.20",
    "@react-navigation/drawer": "^6.6.15",
    "@react-navigation/native": "^6.1.17",
    "@react-navigation/native-stack": "^6.9.26",
    "@supabase/supabase-js": "^2.44.0",
    "@todolist/core": "workspace:*",
    "@todolist/db": "workspace:*",
    "@todolist/ui": "workspace:*",
    "expo": "~52.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "fractional-indexing": "^3.2.0",
    "nativewind": "preview",
    "react": "18.3.2",
    "react-native": "0.76.5",
    "react-native-css": "latest",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.3.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@todolist/config": "workspace:*",
    "@types/react": "~18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create apps/mobile/app.json**

```json
{
  "expo": {
    "name": "TodoList",
    "slug": "todolist",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "backgroundColor": "#0A0A0A"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.yourname.todolist"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0A0A0A"
      },
      "package": "com.yourname.todolist"
    },
    "plugins": [
      "expo-secure-store",
      "react-native-reanimated"
    ]
  }
}
```

- [ ] **Step 3: Create apps/mobile/tsconfig.json**

```json
{
  "extends": "@todolist/config/typescript",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "babel.config.js", "metro.config.js"]
}
```

- [ ] **Step 4: Create apps/mobile/babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      'react-native-reanimated/plugin',
    ],
  };
};
```

- [ ] **Step 5: Create apps/mobile/metro.config.js**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow monorepo packages to be resolved
config.watchFolders = [
  require('path').resolve(__dirname, '../../packages'),
];

module.exports = withNativewind(config, { input: './src/global.css' });
```

- [ ] **Step 6: Create apps/mobile/tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#6366F1',
        surface: '#141414',
        'surface-alt': '#1C1C1C',
        border: '#272727',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 7: Create src/global.css**

```bash
mkdir -p apps/mobile/src
```

Create `apps/mobile/src/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create placeholder entry point**

Create `apps/mobile/src/index.tsx`:

```typescript
import './global.css';
import { registerRootComponent } from 'expo';
import { App } from './App';

registerRootComponent(App);
```

Create `apps/mobile/src/App.tsx`:

```typescript
import React from 'react';
import { Text, View } from 'react-native';

export function App() {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-xl font-semibold">TodoList</Text>
    </View>
  );
}
```

- [ ] **Step 9: Install dependencies**

```bash
pnpm --filter @todolist/mobile install
```

Expected: All packages installed, no resolution errors.

- [ ] **Step 10: Verify the app starts**

```bash
pnpm --filter @todolist/mobile start
```

Expected: Expo dev server starts. Open on simulator/device — see "TodoList" white text on black background.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): bootstrap Expo app with NativeWind v5"
```

---

## Task 2: Supabase client with SecureStore

**Files:**
- Create: `apps/mobile/src/supabase/client.ts`

- [ ] **Step 1: Create apps/mobile/src/supabase/client.ts**

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// SecureStore adapter so Supabase Auth tokens never touch AsyncStorage.
// Backed by iOS Keychain / Android Keystore.
const SecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage:          SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: false,
    },
  }
);
```

- [ ] **Step 2: Create apps/mobile/.env**

```bash
cp ../../.env.example apps/mobile/.env
```

Fill in your actual values in `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
```

- [ ] **Step 3: Add .env to .gitignore**

Ensure `apps/mobile/.env` is covered by the root `.gitignore` (it is — `.env` is already listed).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/supabase/
git commit -m "feat(mobile): add Supabase client with SecureStore token adapter"
```

---

## Task 3: AuthContext and login/register screens

**Files:**
- Create: `apps/mobile/src/auth/AuthContext.tsx`
- Create: `apps/mobile/src/auth/LoginScreen.tsx`
- Create: `apps/mobile/src/auth/RegisterScreen.tsx`

- [ ] **Step 1: Create apps/mobile/src/auth/AuthContext.tsx**

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

interface AuthContextValue {
  session:  Session | null;
  loading:  boolean;
  signIn:   (email: string, password: string) => Promise<void>;
  signUp:   (email: string, password: string) => Promise<void>;
  signOut:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore persisted session from SecureStore on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Create apps/mobile/src/auth/LoginScreen.tsx**

```typescript
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
```

- [ ] **Step 3: Create apps/mobile/src/auth/RegisterScreen.tsx**

```typescript
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
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);

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
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/auth/ apps/mobile/src/supabase/
git commit -m "feat(mobile): add AuthContext, login screen, register screen"
```

---

## Task 4: PowerSync database singleton and Supabase connector

**Files:**
- Create: `apps/mobile/src/powersync/database.ts`
- Create: `apps/mobile/src/powersync/SupabaseConnector.ts`
- Create: `apps/mobile/src/powersync/PowerSyncProvider.tsx`

- [ ] **Step 1: Create apps/mobile/src/powersync/database.ts**

```typescript
import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from '@todolist/db';

// Singleton — created once, never recreated.
// PowerSync keeps the SQLite file open for the app's lifetime.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'todolist.db' },
});
```

- [ ] **Step 2: Create apps/mobile/src/powersync/SupabaseConnector.ts**

```typescript
import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../supabase/client';

const FATAL_CODES = [/^22/, /^23/]; // Postgres class 22 (data), 23 (integrity)

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated — cannot fetch PowerSync credentials');
    }
    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!,
      token:    session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = supabase.from(op.table);
        let result: { error: any };

        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            // Soft delete — set deleted_at so PowerSync propagates the tombstone
            result = await table
              .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', op.id);
            break;
        }

        if (result!.error) throw result!.error;
      }

      await transaction.complete();
    } catch (ex: any) {
      const code = ex?.code ?? '';
      if (FATAL_CODES.some(re => re.test(String(code)))) {
        // Data bug — discard to unblock the queue rather than retry forever
        console.error('Fatal upload error, discarding transaction:', ex);
        await transaction.complete();
      } else {
        throw ex; // Retryable (network, 5xx)
      }
    }
  }
}
```

- [ ] **Step 3: Create apps/mobile/src/powersync/PowerSyncProvider.tsx**

```typescript
import React, { useEffect } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { db } from './database';
import { SupabaseConnector } from './SupabaseConnector';
import { useAuth } from '../auth/AuthContext';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      db.connect(new SupabaseConnector()).catch(console.error);
    } else {
      db.disconnect().catch(console.error);
    }
  }, [session?.access_token]);

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/powersync/
git commit -m "feat(mobile): add PowerSync singleton, SupabaseConnector, PowerSyncProvider"
```

---

## Task 5: Navigation structure

**Files:**
- Create: `apps/mobile/src/navigation/AuthStack.tsx`
- Create: `apps/mobile/src/navigation/AppTabs.tsx`
- Create: `apps/mobile/src/navigation/AppDrawer.tsx`
- Create: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create placeholder screens

- [ ] **Step 1: Create placeholder screens**

Create `apps/mobile/src/screens/InboxScreen.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';
export function InboxScreen() {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-lg font-semibold">Inbox</Text>
      <Text className="text-neutral-500 text-sm mt-1">Plan 1C fills this in</Text>
    </View>
  );
}
```

Create `apps/mobile/src/screens/TodayScreen.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';
export function TodayScreen() {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-lg font-semibold">Today</Text>
    </View>
  );
}
```

Create `apps/mobile/src/screens/UpcomingScreen.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';
export function UpcomingScreen() {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-lg font-semibold">Upcoming</Text>
    </View>
  );
}
```

Create `apps/mobile/src/screens/SearchScreen.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';
export function SearchScreen() {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-lg font-semibold">Search</Text>
    </View>
  );
}
```

Create `apps/mobile/src/screens/ProjectScreen.tsx`:
```typescript
import React from 'react';
import { View, Text } from 'react-native';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { AppDrawerParamList } from '../navigation/AppDrawer';

type Props = DrawerScreenProps<AppDrawerParamList, 'Project'>;

export function ProjectScreen({ route }: Props) {
  return (
    <View className="flex-1 bg-[#0A0A0A] items-center justify-center">
      <Text className="text-white text-lg font-semibold">{route.params.name}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Create apps/mobile/src/navigation/AuthStack.tsx**

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen }    from '../auth/LoginScreen';
import { RegisterScreen } from '../auth/RegisterScreen';

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: Create apps/mobile/src/navigation/AppTabs.tsx**

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { InboxScreen }    from '../screens/InboxScreen';
import { TodayScreen }    from '../screens/TodayScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { SearchScreen }   from '../screens/SearchScreen';
import { colors }         from '@todolist/ui';

export type AppTabsParamList = {
  Inbox:    undefined;
  Today:    undefined;
  Upcoming: undefined;
  Search:   undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

function icon(label: string) {
  // Emoji icons — replaced with an icon library in a later polish pass
  const map: Record<string, string> = {
    Inbox: '📥', Today: '☀️', Upcoming: '📅', Search: '🔍',
  };
  return map[label] ?? '○';
}

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{icon(route.name)}</Text>,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
        },
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Inbox"    component={InboxScreen} />
      <Tab.Screen name="Today"    component={TodayScreen} />
      <Tab.Screen name="Upcoming" component={UpcomingScreen} />
      <Tab.Screen name="Search"   component={SearchScreen} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: Create apps/mobile/src/navigation/AppDrawer.tsx**

The drawer wraps the tab navigator. The left side lists projects.

```typescript
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

      {/* Standard tab items (Inbox, Today, Upcoming, Search) */}
      <DrawerItemList {...props} />

      {/* Projects section */}
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
                backgroundColor: p.color, marginLeft: 'auto',
              }} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Sign out at bottom */}
      <View style={{ marginTop: 'auto', padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable onPress={signOut}>
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
      <Drawer.Screen name="Project" component={ProjectScreen} />
    </Drawer.Navigator>
  );
}
```

- [ ] **Step 5: Create apps/mobile/src/navigation/RootNavigator.tsx**

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth }    from '../auth/AuthContext';
import { AuthStack }  from './AuthStack';
import { AppDrawer }  from './AppDrawer';
import { colors }     from '@todolist/ui';

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <AppDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
}
```

- [ ] **Step 6: Wire everything into App.tsx**

Replace `apps/mobile/src/App.tsx`:

```typescript
import './global.css';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider }       from 'react-native-safe-area-context';
import { AuthProvider }           from './auth/AuthContext';
import { PowerSyncProvider }      from './powersync/PowerSyncProvider';
import { RootNavigator }          from './navigation/RootNavigator';

export function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PowerSyncProvider>
            <RootNavigator />
          </PowerSyncProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 7: Verify the app compiles and renders**

```bash
pnpm --filter @todolist/mobile start
```

Expected: App starts. Not logged in → Login screen. Log in → bottom tab bar (Inbox/Today/Upcoming/Search). Swipe right from left edge → drawer opens showing tabs + empty Projects section + Sign out.

- [ ] **Step 8: Test sign-out clears session**

In the app: sign in → open drawer → tap "Sign out" → should return to Login screen.

Expected: Login screen shown. PowerSync disconnects (check console — no sync errors).

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): wire navigation skeleton — auth stack, bottom tabs, project drawer"
```

---

## Task 6: Verify end-to-end PowerSync sync in the running app

This task confirms the full stack works: login → sync → create task via SQL → see it appear.

- [ ] **Step 1: Sign in to the app on device/simulator**

Open the app. Sign in with the test account created in Plan 1A Task 6 (the spike user).

Expected: App shows bottom tab bar. Check Metro logs — you should see PowerSync sync messages ("Connecting to PowerSync...", "Initial sync complete").

- [ ] **Step 2: Insert a task directly in Supabase SQL Editor**

In Supabase dashboard → SQL Editor:
```sql
INSERT INTO tasks (user_id, title, status, priority, sort_order)
VALUES (auth.uid(), 'Hello from Supabase', 'inbox', 3, 'a0');
```

Wait 3–5 seconds.

- [ ] **Step 3: Verify the task synced to the device**

In Metro terminal, run a quick query against the local PowerSync DB by adding a temporary log to `PowerSyncProvider.tsx` **after** connect:

```typescript
// Temporary — remove after verification
db.connect(new SupabaseConnector()).then(async () => {
  const rows = await db.getAll('SELECT id, title FROM tasks');
  console.log('Local tasks after sync:', rows);
}).catch(console.error);
```

Reload the app and check Metro logs.
Expected: `Local tasks after sync: [{ id: '...', title: 'Hello from Supabase' }]`

- [ ] **Step 4: Remove the temporary log**

Delete the `console.log` added in Step 3.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/powersync/PowerSyncProvider.tsx
git commit -m "chore(mobile): verify end-to-end PowerSync sync, remove temp log"
```

---

## Completion Checklist

Before declaring Phase 1B done, verify:

- [ ] App starts without errors on iOS simulator and/or Android emulator
- [ ] Login screen → enter credentials → navigates to tab bar
- [ ] Register screen → password validation rejects weak passwords
- [ ] Sign out → returns to Login screen, PowerSync disconnects
- [ ] Drawer opens from left edge swipe → shows Projects section (empty) + Sign out
- [ ] Task inserted via Supabase SQL Editor appears in PowerSync local DB within 5s
- [ ] No unhandled errors in Metro console during normal use
