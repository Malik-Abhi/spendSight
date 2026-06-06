import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { StatementScreen } from './src/screens/StatementScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { BottomTabs, TabKey } from './src/components/BottomTabs';
import { useAppStore } from './src/store/useAppStore';
import { getPalette } from '../models/palette';
import { fetchPeople, fetchTransactions } from './src/services/api';
import { AuthSession } from '../models/expense';

const SESSION_KEY = 'spendsight-session';

export default function MobileApp() {
  const { user, token, themeMode, setSession, setTransactions, setPeople, logout } = useAppStore();
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedSession = await AsyncStorage.getItem(SESSION_KEY);
        if (!storedSession) return;
        const session = JSON.parse(storedSession) as AuthSession;
        const [transactions, people] = await Promise.all([fetchTransactions(session.token), fetchPeople(session.token)]);
        setSession(session.token, session.user);
        setTransactions(transactions);
        setPeople(people);
      } catch {
        await AsyncStorage.removeItem(SESSION_KEY);
        logout();
      } finally {
        setBooting(false);
      }
    };

    restoreSession();
  }, [logout, setPeople, setSession, setTransactions]);

  useEffect(() => {
    const persistSession = async () => {
      if (token && user) {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
      } else {
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    };

    if (!booting) {
      persistSession();
    }
  }, [booting, token, user]);

  if (booting) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'right', 'left']} style={[styles.safeArea, styles.boot, { backgroundColor: palette.background }]}>
          <ExpoStatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
          <ActivityIndicator color={palette.primary} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'right', 'left']} style={[styles.safeArea, { backgroundColor: palette.background }]}>
          <ExpoStatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
          <LoginScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'right', 'left']} style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <ExpoStatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        {tab === 'dashboard' && <DashboardScreen />}
        {tab === 'transactions' && <TransactionsScreen />}
        {tab === 'statement' && <StatementScreen />}
        {tab === 'settings' && <SettingsScreen />}
        <BottomTabs activeTab={tab} onChange={setTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  boot: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});
