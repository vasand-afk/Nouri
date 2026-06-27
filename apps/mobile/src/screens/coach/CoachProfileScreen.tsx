import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { db } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function CoachProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuthStore();
  const [coach, setCoach] = useState<any>(null);
  const [existingRelationship, setExistingRelationship] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => { fetchCoach(); }, [id]);

  const fetchCoach = async () => {
    const [coachRes, relRes] = await Promise.all([
      db.coaches()
        .select(`
          *,
          profile:profiles!user_id(
            id, username, display_name, avatar_url, bio, followers_count
          )
        `)
        .eq('id', id)
        .single(),
      session?.user.id
        ? db.from('coach_client_relationships')
            .select('*')
            .eq('coach_id', (await db.coaches().select('user_id').eq('id', id).single()).data?.user_id)
            .eq('client_id', session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setCoach(coachRes.data);
    setExistingRelationship(relRes.data);
    setIsLoading(false);
  };

  const requestCoaching = async () => {
    if (!session?.user.id || !coach) return;
    setIsRequesting(true);

    // Create the coaching relationship
    const { error } = await db.from('coach_client_relationships').insert({
      coach_id: coach.user_id,
      client_id: session.user.id,
      status: 'active',
      access_level: 'diary',
    });

    if (!error) {
      // Notify the coach
      await db.notifications().insert({
        user_id: coach.user_id,
        type: 'new_client',
        title: 'New client request',
        body: `${profile?.display_name ?? profile?.username} wants to work with you`,
        data: { client_id: session.user.id },
      });

      setExistingRelationship({ status: 'active' });
      Alert.alert('Request sent!', `${coach.profile?.display_name ?? 'Your coach'} will be in touch shortly.`);
    } else {
      Alert.alert('Error', 'Could not send request. Please try again.');
    }

    setIsRequesting(false);
  };

  if (isLoading || !coach) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#1A6B3C" size="large" />
      </View>
    );
  }

  const coachProfile = coach.profile;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header gradient */}
        <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.heroGrad}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            {coachProfile?.avatar_url ? (
              <Image source={{ uri: coachProfile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(coachProfile?.display_name ?? coachProfile?.username ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.heroName}>
              <View style={styles.nameRow}>
                <Text style={styles.coachName}>
                  {coachProfile?.display_name ?? coachProfile?.username}
                </Text>
                {coach.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              {coach.credentials && (
                <Text style={styles.credentials}>{coach.credentials}</Text>
              )}
              {coach.ratings_count > 0 && (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Ionicons key={s} name="star" size={14} color="#FCD34D" />
                  ))}
                  <Text style={styles.ratingText}>
                    {coach.ratings_avg.toFixed(1)} · {coach.ratings_count} reviews
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatBox value={coach.clients_count.toString()} label="Clients" />
          <StatBox value={`${coach.years_experience ?? 0}y`} label="Experience" />
          <StatBox
            value={coach.hourly_rate_usd ? `$${coach.hourly_rate_usd.toFixed(0)}` : 'Free'}
            label="Per hour"
          />
          <StatBox
            value={coach.is_accepting_clients ? 'Open' : 'Full'}
            label="Availability"
            valueColor={coach.is_accepting_clients ? '#1A6B3C' : '#DC2626'}
          />
        </View>

        <View style={styles.content}>
          {/* About */}
          {coach.bio && (
            <Section title="About">
              <Text style={styles.bioText}>{coach.bio}</Text>
            </Section>
          )}

          {/* Specialties */}
          {coach.specialties?.length > 0 && (
            <Section title="Specialties">
              <View style={styles.chipWrap}>
                {coach.specialties.map((s: string) => (
                  <View key={s} style={styles.specialtyChip}>
                    <Text style={styles.specialtyText}>{s.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Session types */}
          {coach.session_types?.length > 0 && (
            <Section title="Session Types">
              <View style={styles.sessionTypes}>
                {(coach.session_types as string[]).map(t => {
                  const icons: Record<string, string> = {
                    video: 'videocam',
                    chat: 'chatbubble',
                    async_review: 'document-text',
                  };
                  return (
                    <View key={t} style={styles.sessionTypeChip}>
                      <Ionicons name={(icons[t] ?? 'star') as any} size={14} color="#1A6B3C" />
                      <Text style={styles.sessionTypeText}>{t.replace(/_/g, ' ')}</Text>
                    </View>
                  );
                })}
              </View>
            </Section>
          )}

          {/* What you get */}
          <Section title="What you get">
            {[
              'Personalized meal plans tailored to your goals',
              'Weekly food diary review and feedback',
              'Direct messaging for questions',
              coach.specialties?.includes('glp1_support')
                ? 'Specialized GLP-1 & peptide guidance'
                : 'Ongoing accountability and support',
              'Access to exclusive recipes and resources',
            ].map((item, i) => (
              <View key={i} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#1A6B3C" />
                <Text style={styles.benefitText}>{item}</Text>
              </View>
            ))}
          </Section>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* CTA footer */}
      <View style={styles.footer}>
        {existingRelationship ? (
          <View style={styles.alreadyWorking}>
            <Ionicons name="checkmark-circle" size={20} color="#1A6B3C" />
            <Text style={styles.alreadyWorkingText}>
              {existingRelationship.status === 'active'
                ? 'You\'re working with this coach'
                : 'Request sent'}
            </Text>
          </View>
        ) : (
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerPrice}>
                {coach.hourly_rate_usd ? `$${coach.hourly_rate_usd.toFixed(0)}/hr` : 'Free consultation'}
              </Text>
              <Text style={styles.footerPriceNote}>Cancel anytime</Text>
            </View>
            <TouchableOpacity
              style={[styles.ctaBtn, (!coach.is_accepting_clients || isRequesting) && styles.ctaBtnDisabled]}
              onPress={requestCoaching}
              disabled={!coach.is_accepting_clients || isRequesting}
            >
              {isRequesting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaBtnText}>
                  {coach.is_accepting_clients ? 'Work with me' : 'Not available'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatBox({ value, label, valueColor = '#1A1A1A' }: { value: string; label: string; valueColor?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroGrad: { paddingBottom: 28, paddingTop: 12 },
  backBtn: {
    marginLeft: 16, marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 18,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  heroContent: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  heroName: { flex: 1, paddingTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  coachName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  verifiedText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  credentials: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  ratingText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginLeft: 4 },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  statLabel: { fontSize: 11, color: '#AAA' },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  bioText: { fontSize: 14, color: '#444', lineHeight: 22 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specialtyChip: {
    backgroundColor: '#F0FBF5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  specialtyText: { fontSize: 13, color: '#1A6B3C', fontWeight: '600', textTransform: 'capitalize' },
  sessionTypes: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  sessionTypeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F8F8F8', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  sessionTypeText: { fontSize: 13, color: '#444', fontWeight: '600', textTransform: 'capitalize' },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  benefitText: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerPrice: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  footerPriceNote: { fontSize: 12, color: '#AAA' },
  ctaBtn: {
    backgroundColor: '#1A6B3C', borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  ctaBtnDisabled: { backgroundColor: '#CCC' },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  alreadyWorking: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  alreadyWorkingText: { fontSize: 15, color: '#1A6B3C', fontWeight: '600' },
});
