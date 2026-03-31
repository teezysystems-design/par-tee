import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'options' | 'magic-link' | 'otp-verify';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('options');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectUri = makeRedirectUri({ scheme: 'teezy' });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
    } catch (err: unknown) {
      Alert.alert('Sign-in error', err instanceof Error ? err.message : 'Could not sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
    } catch (err: unknown) {
      Alert.alert('Sign-in error', err instanceof Error ? err.message : 'Could not sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setMode('otp-verify');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Code required', 'Please enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;
      // Auth state change will trigger navigation via root layout
    } catch (err: unknown) {
      Alert.alert('Invalid code', err instanceof Error ? err.message : 'Code verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'magic-link') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Sign in with email</Text>
        <Text style={styles.subtitle}>We'll send a one-time code to your inbox</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSendMagicLink} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send code</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={() => setMode('options')}>
          <Text style={styles.textBtnText}>← Back</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  if (mode === 'otp-verify') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor="#999"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOtp} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify code</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.textBtn} onPress={() => { setMode('magic-link'); setOtp(''); }}>
          <Text style={styles.textBtnText}>← Re-send code</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>⛳</Text>
      <Text style={styles.title}>Welcome to Teezy</Text>
      <Text style={styles.subtitle}>Discover tee times that match your mood</Text>

      <TouchableOpacity style={[styles.oauthBtn, styles.googleBtn]} onPress={handleGoogleSignIn} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#333" />
        ) : (
          <Text style={styles.oauthBtnText}>Continue with Google</Text>
        )}
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity style={[styles.oauthBtn, styles.appleBtn]} onPress={handleAppleSignIn} disabled={loading}>
          <Text style={[styles.oauthBtnText, { color: '#fff' }]}>Continue with Apple</Text>
        </TouchableOpacity>
      )}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('magic-link')} disabled={loading}>
        <Text style={styles.primaryBtnText}>Continue with email</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a7f4b', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 40 },
  oauthBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  googleBtn: { backgroundColor: '#fff', borderColor: '#ddd' },
  appleBtn: { backgroundColor: '#000', borderColor: '#000' },
  oauthBtnText: { fontSize: 16, fontWeight: '600', color: '#333' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 14 },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#1a7f4b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#111',
  },
  textBtn: { paddingVertical: 8 },
  textBtnText: { color: '#1a7f4b', fontSize: 15 },
});
