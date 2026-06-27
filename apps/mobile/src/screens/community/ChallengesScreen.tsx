import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { db } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Challenge } from '@nouri/shared/types';

const CHALLENGE_COLORS: Record<string, [string, string]> = {
  protein_goal: ['#4CAF50', '#27A85F'],
  calorie_goal: ['#FF9800', '#F44336'],
  logging_streak: ['#2196F3', '#3F51B5'],
  water_intake: ['#00BCD4', '#2196F3'],
  weight_loss: ['#9C27B0', '#673AB7'],
  custom: ['#1A6B3C', '#27A85F'],
};

const CHALLENGE_ICONS: Record<string, string> = {
  protein_goal: 'barbell',
  calorie_goal: 'flame',
  logging_streak: 'calendar-outline',
  water_intake: 'water',
  weight_loss: 'trending-down',
  custom: 'trophy',
};

export default function ChallengesScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [challenges, setChallenges] = useState<any[]>([]);
  const [participantMap, setParticipantMap] = useState<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'completed'>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchChallenges(); }, [activeTab]);

  const fetchChallenges = async () => {
    setIsLoading(true);
    const today = new Date().toISOString().split('T')[0];

    let q = db.challenges()
      .select('*')
      .eq('is_public', true)
      .order('participants_count', { ascending: false })
      .limit(30);

    if (activeTab === 'active') {
      q = q.lte('start_date', today).gte('end_date', today);
    } else if (activeTab === 'upcoming') {
      q = q.gt('start_date', today);
    } else {
      q = q.lt('end_date', today);
    }

    const { data } = await q;
    setChallenges((data ?? []) as any[]);

    if (session?.user.id && data) {
      const ids = data.map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: parts } = await db.challengeParticipants()
          .select('*')
          .eq('user_id', session.user.id)
          .in('challenge_id', ids);

        const map = new Map<string, any>();
        (parts ?? []).forEach((p: any) => map.set(p.challenge_id, p));
        setParticipantMap(map);
      }
    }

    setIsLoading(false);
  };

  const joinChallenge = async (challenge: any) => {
    if (!session?.user.id) return;
    if (participantMap.has(challenge.id)) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await db.challengeParticipants().insert({
      challenge_id: challenge.id,
      user_id: session.user.id,
      current_value: 0,
    });
    await db.challenges()
      .update({ participants_count: challenge.participants_count + 1 })
      .eq('id', challenge.id);

    setParticipantMap(prev => {
      const next = new Map(prev);
      next.set(challenge.id, { current_value: 0, completed: false });
      return next;
    });

    Alert.alert('Joined! 🎉', `You've joined "${challenge.title}". Good luck!`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Challenges</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/community/challenges/create')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['active', 'upcoming', 'completed'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My progress strip */}
      {participantMap.size > 0 && activeTab === 'active' && (
        <View style={styles.myProgressStrip}>
          <Ionicons name="trophy" size={16} color="#FF9800" />
          <Text style={styles.myProgressText}>
            You're in {participantMap.size} active challenge{participantMap.size > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#1A6B3C" size="large" />
        </View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <ChallengeCard
              challenge={item}
              participation={participantMap.get(item.id)}
              onJoin={() => joinChallenge(item)}
              onPress={() => router.push(`/community/challenges/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'active' ? 'No active challenges' : `No ${activeTab} challenges`}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/community/challenges/create')}
              >
                <Text style={styles.emptyBtnText}>Start a Challenge</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ChallengeCard({ challenge, participation, onJoin, onPress }: {
  challenge: any; participation: any; onJoin: () => void; onPress: () => void;
}) {
  const colors = CHALLENGE_COLORS[challenge.challenge_type] ?? CHALLENGE_COLORS.custom;
  const icon = CHALLENGE_ICONS[challenge.challenge_type] ?? 'trophy';
  const daysLeft = differenceInDays(new Date(challenge.end_date), new Date());
  const daysTotal = differenceInDays(new Date(challenge.end_date), new Date(challenge.start_date));
  const progress = participation
    ? Math.min(1, participation.current_value / (challenge.target_value || 1))
    : 0;
  const isJoined = !!participation;
  const isCompleted = participation?.completed;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* Gradient header */}
      <LinearGradient colors={colors} style={styles.cardHero}>
        <View style={styles.heroTop}>
          <View style={styles.challengeIconBox}>
            <Ionicons name={icon as any} size={22} color="#fff" />
          </View>
          <View style={styles.heroMeta}>
            {daysLeft >= 0 ? (
              <Text style={styles.daysLeft}>
                {daysLeft === 0 ? 'Last day!' : `${daysLeft} days left`}
              </Text>
            ) : (
              <Text style={styles.daysLeft}>Ended</Text>
            )}
          </View>
        </View>
        <Text style={styles.challengeTitle}>{challenge.title}</Text>
        <Text style={styles.challengeTarget}>
          Goal: {challenge.target_value} {challenge.target_unit}
        </Text>
      </LinearGradient>

      {/* Body */}
      <View style={styles.cardBody}>
        {challenge.description && (
          <Text style={styles.challengeDesc} numberOfLines={2}>{challenge.description}</Text>
        )}

        {/* Progress bar (if joined) */}
        {isJoined && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Your progress</Text>
              <Text style={styles.progressValue}>
                {participation.current_value} / {challenge.target_value} {challenge.target_unit}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={colors}
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#1A6B3C" />
                <Text style={styles.completedText}>Completed! 🎉</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <Ionicons name="people" size={14} color="#AAA" />
            <Text style={styles.participantsText}>
              {challenge.participants_count} participant{challenge.participants_count !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.dateDot}>·</Text>
            <Text style={styles.dateRange}>
              {format(new Date(challenge.start_date), 'MMM d')} –{' '}
              {format(new Date(challenge.end_date), 'MMM d')}
            </Text>
          </View>

          {!isJoined && daysLeft >= 0 && (
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: colors[0] }]}
              onPress={onJoin}
            >
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )}
          {isJoined && !isCompleted && (
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark" size={12} color="#1A6B3C" />
              <Text style={styles.joinedText}>Joined</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1A6B3C', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1A6B3C' },
  tabText: { fontSize: 13, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#1A6B3C' },
  myProgressStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 8,
  },
  myProgressText: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    marginBottom: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardHero: { padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  challengeIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroMeta: {},
  daysLeft: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  challengeTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  challengeTarget: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  cardBody: { padding: 16 },
  challengeDesc: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 12 },
  progressSection: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  progressValue: { fontSize: 12, color: '#1A1A1A', fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
  },
  completedText: { fontSize: 12, color: '#1A6B3C', fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  participantsText: { fontSize: 12, color: '#AAA' },
  dateDot: { color: '#DDD' },
  dateRange: { fontSize: 12, color: '#AAA' },
  joinBtn: {
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 7,
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  joinedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FBF5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  joinedText: { fontSize: 12, color: '#1A6B3C', fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 16, color: '#999' },
  emptyBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
