import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuthStore();
  const [challenge, setChallenge] = useState<any>(null);
  const [participation, setParticipation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !session?.user.id) return;
    Promise.all([
      db.challenges().select('*').eq('id', id).single(),
      db.challengeParticipants().select('*').eq('challenge_id', id).eq('user_id', session.user.id).maybeSingle(),
    ]).then(([{ data: c }, { data: p }]) => {
      setChallenge(c);
      setParticipation(p);
      setLoading(false);
    });
  }, [id]);

  const joinOrLeave = async () => {
    if (!session?.user.id || !id) return;
    if (participation) {
      Alert.alert('Leave challenge?', 'Your progress will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: async () => {
            await db.challengeParticipants().delete().eq('challenge_id', id).eq('user_id', session.user.id);
            setParticipation(null);
          },
        },
      ]);
    } else {
      const { data } = await db.challengeParticipants().insert({
        challenge_id: id,
        user_id: session.user.id,
        progress: 0,
      }).select().single();
      setParticipation(data);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1A6B3C" />;

  const start = challenge?.start_date ? new Date(challenge.start_date).toLocaleDateString() : '—';
  const end = challenge?.end_date ? new Date(challenge.end_date).toLocaleDateString() : '—';
  const progress = participation?.progress ?? 0;
  const goal = challenge?.goal_value ?? 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{challenge?.title ?? 'Challenge'}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.challengeTitle}>{challenge?.title}</Text>
          <Text style={styles.dates}>{start} → {end}</Text>
          {challenge?.description ? <Text style={styles.desc}>{challenge.description}</Text> : null}
        </View>

        {participation && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>Your progress</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (progress / goal) * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress} / {goal} {challenge?.goal_unit ?? 'points'}</Text>
          </View>
        )}

        <View style={styles.statsCard}>
          <StatCell icon="people" label="Participants" value={String(challenge?.participant_count ?? 0)} />
          <StatCell icon="trophy" label="Goal" value={`${goal} ${challenge?.goal_unit ?? ''}`} />
          <StatCell icon="calendar" label="Duration" value={challenge?.duration_days ? `${challenge.duration_days} days` : '—'} />
        </View>

        <TouchableOpacity
          style={[styles.joinBtn, participation && styles.leaveBtn]}
          onPress={joinOrLeave}
        >
          <Text style={[styles.joinText, participation && styles.leaveText]}>
            {participation ? 'Leave Challenge' : 'Join Challenge'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Ionicons name={icon} size={20} color="#1A6B3C" />
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#999' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, gap: 12 },
  heroCard: { backgroundColor: '#1A6B3C', borderRadius: 16, padding: 20 },
  challengeTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  dates: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
  progressCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 },
  progressLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  progressBar: { height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1A6B3C', borderRadius: 5 },
  progressText: { fontSize: 13, color: '#666', textAlign: 'right' },
  statsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row' },
  joinBtn: { backgroundColor: '#1A6B3C', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  leaveBtn: { backgroundColor: '#FEE2E2' },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  leaveText: { color: '#EF4444' },
});
