import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Booking {
  id: string; startsAt: string; status: string; consultationType: string; feePaise: number;
  doctor?: { firstName: string; lastName: string; specialisation: string; };
}
interface Res { bookings: Booking[]; total: number; }

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#10B981', PENDING_PAYMENT: '#F59E0B', COMPLETED: '#6B7280',
  CANCELLED_BY_PATIENT: '#EF4444', CANCELLED_BY_DOCTOR: '#EF4444',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function BookingsScreen() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-bookings', tab],
    queryFn: () => api.get<Res>(
      `/bookings?limit=20&page=1&status=${tab === 'upcoming' ? 'CONFIRMED,PENDING_PAYMENT' : 'COMPLETED,CANCELLED_BY_PATIENT'}`,
    ),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`, { reason: 'Cancelled by patient' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-bookings'] }),
    onError: (e: unknown) => Alert.alert('Error', e instanceof Error ? e.message : 'Cancel failed'),
  });

  const bookings = data?.bookings ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Bookings</Text>
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No {tab} bookings</Text>}
          renderItem={({ item: b }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{b.doctor?.firstName?.[0] ?? 'D'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>Dr. {b.doctor?.firstName} {b.doctor?.lastName}</Text>
                  <Text style={styles.docSpec}>{b.doctor?.specialisation}</Text>
                  <Text style={styles.meta}>{fmt(b.startsAt)}  ·  ₹{Math.round(b.feePaise / 100)}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[b.status] ?? '#6B7280') + '20' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[b.status] ?? '#6B7280' }]}>{b.status.replace(/_/g, ' ')}</Text>
                </View>
                {b.status === 'CONFIRMED' && (
                  <TouchableOpacity style={styles.cancelBtn}
                    onPress={() => Alert.alert('Cancel booking?', '', [
                      { text: 'No', style: 'cancel' },
                      { text: 'Yes', style: 'destructive', onPress: () => cancelMut.mutate(b.id) },
                    ])}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#0EA5E9' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  cardLeft: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardRight: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#2563EB' },
  docName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  docSpec: { fontSize: 12, color: '#0EA5E9', marginTop: 1 },
  meta: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  cancelText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
});
