import { useState, useCallback } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';

interface Doctor {
  id: string; firstName: string; lastName: string; specialisation: string;
  experienceYears: number; consultationFee: number; rating?: number; consultationTypes: string[];
}
interface DoctorsRes { doctors: Doctor[]; total: number; }

function DoctorItem({ doctor }: { doctor: Doctor }) {
  const feeRupees = Math.round(doctor.consultationFee / 100);
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/doctor/${doctor.id}` as never)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{doctor.firstName[0]}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>Dr. {doctor.firstName} {doctor.lastName}</Text>
        <Text style={styles.cardSpec}>{doctor.specialisation}</Text>
        <Text style={styles.cardMeta}>{doctor.experienceYears} yrs exp  ·  ₹{feeRupees}</Text>
      </View>
      {doctor.rating && (
        <View style={styles.rating}>
          <Text style={styles.ratingText}>⭐ {doctor.rating.toFixed(1)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function FindDoctorsScreen() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['doctors', query],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '10', page: '1' });
      if (query) params.set('q', query);
      return api.get<DoctorsRes>(`/doctors?${params}`);
    },
    staleTime: 30_000,
  });

  const handleSearch = useCallback(() => setQuery(search), [search]);
  const doctors = data?.doctors ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.firstName ?? 'there'} 👋</Text>
        <Text style={styles.title}>Find Trusted Doctors</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors, specialities..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {/* CTA row */}
      <View style={styles.ctaRow}>
        <TouchableOpacity style={styles.ctaPrimary} onPress={() => setQuery('video')}>
          <Text style={styles.ctaPrimaryText}>📹 Video Consult</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctaSecondary} onPress={() => setQuery('clinic')}>
          <Text style={styles.ctaSecondaryText}>🏥 Clinic Visit</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => <DoctorItem doctor={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No doctors found</Text>
              <TouchableOpacity onPress={() => { setSearch(''); setQuery(''); refetch(); }}>
                <Text style={styles.emptyLink}>Clear search</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 2 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginVertical: 12 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827',
  },
  searchBtn: { backgroundColor: '#0EA5E9', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ctaRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  ctaPrimary: { flex: 1, backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  ctaSecondary: { flex: 1, borderWidth: 1.5, borderColor: '#0EA5E9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaSecondaryText: { color: '#0EA5E9', fontWeight: '600', fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#F3F4F6',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#DBEAFE',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#2563EB' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardSpec: { fontSize: 12, color: '#0EA5E9', marginTop: 1 },
  cardMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rating: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
  emptyLink: { color: '#0EA5E9', marginTop: 8, fontSize: 14, fontWeight: '600' },
});
