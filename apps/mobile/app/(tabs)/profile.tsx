import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
    clearAuth();
    router.replace('/(auth)/login' as never);
  }

  const menuItems = [
    { icon: '📅', label: 'My Bookings', onPress: () => router.push('/(tabs)/bookings' as never) },
    { icon: '🔔', label: 'Notifications', onPress: () => {} },
    { icon: '🔒', label: 'Privacy & Security', onPress: () => {} },
    { icon: '📞', label: 'Support', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.firstName?.[0]?.toUpperCase() ?? 'U'}</Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{user?.role ?? ''}</Text></View>
        </View>
      </View>

      <View style={styles.menu}>
        {menuItems.map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn}
        onPress={() => Alert.alert('Log out?', 'You will need to sign in again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: handleLogout },
        ])}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
      <Text style={styles.version}>DocNear v1.0.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 20, backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#2563EB' },
  name: { fontSize: 18, fontWeight: '700', color: '#111827' },
  email: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  roleBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#DBEAFE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  menu: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { flex: 1, fontSize: 14, color: '#374151' },
  menuArrow: { fontSize: 20, color: '#9CA3AF' },
  logoutBtn: { margin: 20, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginBottom: 8 },
});
