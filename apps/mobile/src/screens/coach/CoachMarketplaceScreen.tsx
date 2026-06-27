import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { db } from '../../services/supabase';
import { CoachProfile } from '@nouri/shared/types';

const SPECIALTIES = [
  { key: 'all', label: 'All' },
  { key: 'weight_loss', label: '⬇️ Weight Loss' },
  { key: 'glp1_support', label: '💉 GLP-1 Support' },
  { key: 'sports_nutrition', label: '🏋️ Sports' },
  { key: 'eating_disorders', label: '❤️ Eating Recovery' },
  { key: 'diabetes', label: '🩸 Diabetes' },
  { key: 'plant_based', label: '🌱 Plant-Based' },
];

export default function CoachMarketplaceScreen() {
  const router = useRouter();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { fetchCoaches(); }, [activeSpecialty, query]);

  const fetchCoaches = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    let q = db.coaches()
      .select(`
        *,
        profile:profiles!user_id(
          id, username, display_name, avatar_url, bio
        )
      `)
      .eq('is_accepting_clients', true)
      .order('ratings_avg', { ascending: false })
      .limit(30);

    if (activeSpecialty !== 'all') {
      q = q.contains('specialties', [activeSpecialty]);
    }

    const { data } = await q;

    let results = (data ?? []) as any[];

    if (query.length > 1) {
      const lower = query.toLowerCase();
      results = results.filter(c =>
        c.profile?.display_name?.toLowerCase().includes(lower) ||
        c.bio?.toLowerCase().includes(lower) ||
        c.credentials?.toLowerCase().includes(lower)
      );
    }

    setCoaches(results);
    setIsLoading(false);
    setIsRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Find a Coach</Text>
          <Text style={styles.subtitle}>Certified dietitians & nutrition coaches</Text>
        </View>
        <TouchableOpacity
          style={styles.becomeCoachBtn}
          onPress={() => router.push('/coach/apply')}
        >
          <Text style={styles.becomeCoachText}>Become a Coach</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color="#AAA" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, specialty..."
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Specialty filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {SPECIALTIES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.filterChip, activeSpecialty === s.key && styles.filterChipActive]}
            onPress={() => setActiveSpecialty(s.key)}
          >
            <Text style={[styles.filterChipText, activeSpecialty === s.key && styles.filterChipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Featured GLP-1 banner */}
      {activeSpecialty === 'all' && (
        <TouchableOpacity
          style={styles.glp1Banner}
          onPress={() => setActiveSpecialty('glp1_support')}
        >
          <View style={styles.glp1BannerLeft}>
            <Text style={styles.glp1BannerEmoji}>💉</Text>
            <View>
              <Text style={styles.glp1BannerTitle}>GLP-1 Specialist Coaches</Text>
              <Text style={styles.glp1BannerSub}>
                Experts in semaglutide, tirzepatide & peptide protocols
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#1A6B3C" size="large" />
        </View>
      ) : (
        <FlatList
          data={coaches}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <CoachCard
              coach={item}
              onPress={() => router.push(`/coach/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchCoaches(true)}
              tintColor="#1A6B3C"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No coaches found</Text>
              <Text style={styles.emptyText}>Try a different specialty or search term</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function CoachCard({ coach, onPress }: { coach: any; onPress: () => void }) {
  const profile = coach.profile;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.cardHeader}>
        {/* Avatar */}
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {(profile?.display_name ?? profile?.username ?? '?')[0].toUpperCase()}
            </Text>
          </View>
        )}

        {/* Name + credentials */}
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.coachName}>
              {profile?.display_name ?? profile?.username}
            </Text>
            {coach.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color="#1A6B3C" />
            )}
          </View>
          {coach.credentials && (
            <Text style={styles.credentials}>{coach.credentials}</Text>
          )}
          {coach.ratings_count > 0 && (
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <Ionicons
                  key={s}
                  name={s <= Math.round(coach.ratings_avg) ? 'star' : 'star-outline'}
                  size={12}
                  color="#FF9800"
                />
              ))}
              <Text style={styles.ratingText}>
                {coach.ratings_avg.toFixed(1)} ({coach.ratings_count})
              </Text>
            </View>
          )}
        </View>

        {/* Rate */}
        <View style={styles.rateBox}>
          {coach.hourly_rate_usd ? (
            <>
              <Text style={styles.rate}>${coach.hourly_rate_usd.toFixed(0)}</Text>
              <Text style={styles.rateUnit}>/hr</Text>
            </>
          ) : (
            <Text style={styles.rateContact}>Contact</Text>
          )}
        </View>
      </View>

      {/* Bio */}
      {coach.bio && (
        <Text style={styles.bio} numberOfLines={2}>{coach.bio}</Text>
      )}

      {/* Specialties */}
      {coach.specialties?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {coach.specialties.map((s: string) => (
            <View key={s} style={styles.specialtyChip}>
              <Text style={styles.specialtyText}>{s.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.footerStat}>
          <Ionicons name="people" size={13} color="#888" />
          <Text style={styles.footerStatText}>{coach.clients_count} clients</Text>
        </View>
        <View style={styles.footerStat}>
          <Ionicons name="time" size={13} color="#888" />
          <Text style={styles.footerStatText}>{coach.years_experience ?? 0} yrs exp</Text>
        </View>
        <View style={styles.footerStat}>
          <Ionicons name="videocam" size={13} color="#888" />
          <Text style={styles.footerStatText}>
            {(coach.session_types ?? []).join(' · ') || 'Chat'}
          </Text>
        </View>

        <TouchableOpacity style={styles.contactBtn} onPress={onPress}>
          <Text style={styles.contactBtnText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  becomeCoachBtn: {
    borderWidth: 1.5, borderColor: '#1A6B3C', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  becomeCoachText: { color: '#1A6B3C', fontWeight: '700', fontSize: 13 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  filterScroll: { maxHeight: 44 },
  filterRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F0F0F0',
  },
  filterChipActive: { backgroundColor: '#1A6B3C' },
  filterChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  glp1Banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#F5F0FF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  glp1BannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glp1BannerEmoji: { fontSize: 24 },
  glp1BannerTitle: { fontSize: 14, fontWeight: '700', color: '#4C1D95' },
  glp1BannerSub: { fontSize: 12, color: '#7C3AED', marginTop: 2 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '700', color: '#1A6B3C' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coachName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  credentials: { fontSize: 12, color: '#1A6B3C', fontWeight: '600', marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  ratingText: { fontSize: 12, color: '#555', marginLeft: 4 },
  rateBox: { alignItems: 'flex-end' },
  rate: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  rateUnit: { fontSize: 11, color: '#888' },
  rateContact: { fontSize: 13, color: '#1A6B3C', fontWeight: '700' },
  bio: { fontSize: 13, color: '#555', lineHeight: 19 },
  specialtyChip: {
    backgroundColor: '#F0FBF5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginRight: 6,
  },
  specialtyText: { fontSize: 11, color: '#1A6B3C', fontWeight: '600', textTransform: 'capitalize' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  footerStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footerStatText: { fontSize: 11, color: '#888' },
  contactBtn: {
    marginLeft: 'auto', backgroundColor: '#1A6B3C', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  contactBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  emptyText: { fontSize: 14, color: '#999' },
});
