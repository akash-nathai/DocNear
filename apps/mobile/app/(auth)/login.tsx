import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import type { AuthUser } from '../../store/auth';

interface LoginRes { accessToken: string; user: AuthUser }

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
    setLoading(true);
    try {
      const res = await api.post<LoginRes>('/auth/login', { email, password });
      setAuth(res.user, res.accessToken);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Login Failed', e instanceof Error ? e.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoDoc}>Doc</Text>
          <Text style={styles.logoNear}>Near</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#9CA3AF"
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#9CA3AF"
            value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.link}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F9FF' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  logoDoc: { fontSize: 32, fontWeight: '800', color: '#0EA5E9' },
  logoNear: { fontSize: 32, fontWeight: '800', color: '#111827' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginTop: 4 },
  sub: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 28 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
  },
  btn: {
    backgroundColor: '#0EA5E9', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#6B7280', fontSize: 14 },
  link: { color: '#0EA5E9', fontWeight: '600', fontSize: 14 },
});
