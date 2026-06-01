import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { getPalette } from '../theme/palette';
import { fetchPeople, fetchTransactions, loginWithEmail, loginWithGoogle, signupWithEmail } from '../services/api';
import { BrandLogo } from '../components/BrandLogo';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const { setSession, setTransactions, setPeople, themeMode } = useAppStore();
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    webClientId: googleClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || googleClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || googleClientId,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true
  });

  useEffect(() => {
    const finishGoogleLogin = async () => {
      if (response?.type !== 'success') return;

      const accessToken = response.authentication?.accessToken || response.params.access_token;
      if (!accessToken) {
        setError('Google did not return a sign-in token.');
        return;
      }

      setGoogleLoading(true);
      setError('');
      try {
        const session = await loginWithGoogle(accessToken);
        const [transactions, people] = await Promise.all([fetchTransactions(session.token), fetchPeople(session.token)]);
        setSession(session.token, session.user);
        setTransactions(transactions);
        setPeople(people);
      } catch {
        setError('Google login failed. Check the API server and Google client ID.');
      } finally {
        setGoogleLoading(false);
      }
    };

    finishGoogleLogin();
  }, [response, setPeople, setSession, setTransactions]);

  const handleManualLogin = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Enter your name to create an account.');
      return;
    }

    setManualLoading(true);
    setError('');
    try {
      const session =
        mode === 'signup'
          ? await signupWithEmail(name.trim(), email.trim(), password)
          : await loginWithEmail(email.trim(), password);
      const [transactions, people] = await Promise.all([fetchTransactions(session.token), fetchPeople(session.token)]);
      setSession(session.token, session.user);
      setTransactions(transactions);
      setPeople(people);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not continue.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleClientId) {
      setError('Google login is not configured.');
      return;
    }

    setError('');
    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        setGoogleLoading(false);
      }
    } catch {
      setGoogleLoading(false);
      setError('Google login could not be opened.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
      <ScrollView
        contentContainerStyle={styles.container}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <BrandLogo width={292} height={112} />
          </View>
          <Text style={[styles.kicker, { color: palette.primary }]}>Personal finance clarity</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Track expenses, scan statements, and see where your money moves every month.
          </Text>
        </View>

        <View style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>Welcome</Text>
          <Text style={[styles.formCopy, { color: palette.muted }]}>Sign in to sync your personal spending data.</Text>
          {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
          <Pressable
            style={[styles.googleButton, { borderColor: palette.border, opacity: request && !googleLoading ? 1 : 0.65 }]}
            onPress={handleGoogleLogin}
            disabled={!request || googleLoading}
          >
            <Text style={styles.googleMark}>G</Text>
            <Text style={[styles.googleText, { color: palette.text }]}>{googleLoading ? 'Connecting' : 'Continue with Google'}</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
            <Text style={[styles.dividerText, { color: palette.muted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
          </View>

          <View style={[styles.modeSwitch, { backgroundColor: palette.elevated }]}>
            {(['login', 'signup'] as const).map((item) => {
              const active = mode === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setMode(item);
                    setError('');
                  }}
                  style={[styles.modeButton, active && { backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.modeText, { color: active ? palette.text : palette.muted }]}>{item === 'login' ? 'Sign in' : 'Create'}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'signup' ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.text, borderColor: palette.border }]}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border }]}
          />
          <Pressable style={[styles.button, { backgroundColor: palette.primary, opacity: manualLoading ? 0.7 : 1 }]} onPress={handleManualLogin} disabled={manualLoading}>
            <Text style={styles.buttonText}>{manualLoading ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create account'}</Text>
            <Ionicons name="arrow-forward" size={20} color={palette.primaryText} />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
    paddingBottom: 36
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24
  },
  logo: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'center'
  },
  form: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5
  },
  formTitle: {
    fontSize: 21,
    fontWeight: '900'
  },
  formCopy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: -5
  },
  error: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18
  },
  googleButton: {
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10
  },
  googleMark: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    color: '#1F2937',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center'
  },
  googleText: {
    fontSize: 15,
    fontWeight: '900'
  },
  divider: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dividerLine: {
    flex: 1,
    height: 1
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16
  },
  modeSwitch: {
    height: 42,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    gap: 4
  },
  modeButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeText: {
    fontSize: 13,
    fontWeight: '900'
  },
  button: {
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  buttonText: {
    color: '#042F2E',
    fontSize: 16,
    fontWeight: '800'
  }
});
