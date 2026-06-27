import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../stores/authStore';
import { useDiaryStore } from '../../stores/diaryStore';
import MacroRing from '../../components/diary/MacroRing';
import MealSection from '../../components/diary/MealSection';
import WaterTracker from '../../components/diary/WaterTracker';
import GLP1Banner from '../../components/glp1/GLP1Banner';
import InsightCard from '../../components/shared/InsightCard';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, session } = useAuthStore();
  const { summary, entries, waterMl, isLoading, fetchDay, logWater, getEntriesByMeal } = useDiaryStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const greeting = getGreeting();

  const logButtonScale = useSharedValue(1);
  const logButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logButtonScale.value }],
  }));

  useEffect(() => {
    if (session?.user.id) {
      fetchDay(today, session.user.id);
    }
  }, [session?.user.id]);

  // Pulse the log button if no meals logged yet
  useEffect(() => {
    if (entries.length === 0) {
      logButtonScale.value = withRepeat(
        withSequence(withSpring(1.06), withSpring(1)),
        -1,
        true
      );
    } else {
      logButtonScale.value = withSpring(1);
    }
  }, [entries.length]);

  const targets = {
    calories: profile?.daily_calories_target ?? 2000,
    protein: profile?.protein_target_g ?? 150,
    carbs: profile?.carbs_target_g ?? 200,
    fat: profile?.fat_target_g ?? 65,
  };

  const consumed = {
    calories: summary?.total_calories ?? 0,
    protein: summary?.total_protein_g ?? 0,
    carbs: summary?.total_carbs_g ?? 0,
    fat: summary?.total_fat_g ?? 0,
  };

  const remaining = Math.max(0, targets.calories - consumed.calories);
  const mealsByType = getEntriesByMeal();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => session?.user.id && fetchDay(today, session.user.id)}
            tintColor="#1A6B3C"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{profile?.display_name ?? profile?.username ?? 'there'} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/profile')}
          >
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#1A6B3C" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Date strip */}
        <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d')}</Text>

        {/* GLP-1 Banner (only for GLP-1 users) */}
        {profile?.is_glp1_user && (
          <GLP1Banner onPress={() => router.push('/glp1')} />
        )}

        {/* Calorie Ring + Macros */}
        <LinearGradient
          colors={['#F0FBF5', '#E8F8EE']}
          style={styles.nutriCard}
        >
          <View style={styles.ringRow}>
            <MacroRing
              consumed={consumed.calories}
              target={targets.calories}
              size={160}
              color="#1A6B3C"
              label="kcal"
              centerText={remaining.toFixed(0)}
              centerLabel="remaining"
            />

            <View style={styles.macroBreakdown}>
              <MacroBar label="Protein" value={consumed.protein} target={targets.protein} color="#4CAF50" unit="g" />
              <MacroBar label="Carbs" value={consumed.carbs} target={targets.carbs} color="#FF9800" unit="g" />
              <MacroBar label="Fat" value={consumed.fat} target={targets.fat} color="#2196F3" unit="g" />
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatChip icon="restaurant" label="Eaten" value={`${consumed.calories.toFixed(0)} kcal`} />
            <StatChip icon="flame" label="Burned" value="—" />
            <StatChip icon="trending-up" label="Streak" value={`${3}d`} />
          </View>
        </LinearGradient>

        {/* Water Tracker */}
        <WaterTracker
          currentMl={waterMl}
          targetMl={profile?.weight_kg ? profile.weight_kg * 35 : 2500}
          onAdd={(ml) => session?.user.id && logWater(ml, session.user.id)}
        />

        {/* Log Food FAB */}
        <Animated.View style={[styles.logFabContainer, logButtonStyle]}>
          <TouchableOpacity
            style={styles.logFab}
            onPress={() => router.push('/diary/log')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.logFabGradient}>
              <Ionicons name="add" size={28} color="#fff" />
              <Text style={styles.logFabText}>Log Food</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Meal Sections */}
        <View style={styles.mealsContainer}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
            <MealSection
              key={meal}
              mealType={meal}
              entries={mealsByType[meal]}
              onAdd={() => router.push({ pathname: '/diary/log', params: { meal } })}
            />
          ))}
        </View>

        {/* AI Insight Card */}
        {entries.length > 0 && (
          <InsightCard
            title="Today's Insight"
            body={generateInsight(consumed, targets, profile?.is_glp1_user ?? false)}
            onTap={() => router.push('/ai')}
            icon="sparkles"
          />
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────

function MacroBar({
  label, value, target, color, unit,
}: {
  label: string; value: number; target: number; color: string; unit: string;
}) {
  const pct = Math.min(1, value / Math.max(1, target));
  return (
    <View style={styles.macroBar}>
      <View style={styles.macroBarHeader}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarValue}>{value.toFixed(0)}/{target}{unit}</Text>
      </View>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatChip({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={16} color="#1A6B3C" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function generateInsight(
  consumed: { calories: number; protein: number },
  targets: { calories: number; protein: number },
  isGlp1: boolean
): string {
  const proteinPct = consumed.protein / Math.max(1, targets.protein);
  if (isGlp1 && proteinPct < 0.5) {
    return "On GLP-1? Prioritize protein even when appetite is low — aim for at least 30g per meal to protect muscle mass.";
  }
  if (proteinPct < 0.4) {
    return `You're at ${Math.round(proteinPct * 100)}% of your protein goal. Add a high-protein snack like Greek yogurt or cottage cheese.`;
  }
  if (consumed.calories > targets.calories * 0.85) {
    return `You've hit ${Math.round((consumed.calories / targets.calories) * 100)}% of your calorie goal. Great consistency today!`;
  }
  return "Tap here to chat with your AI nutrition coach for personalized advice.";
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  greeting: { fontSize: 14, color: '#666', fontWeight: '500' },
  name: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginTop: 2 },
  avatarBtn: { padding: 4 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 13,
    color: '#999',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  nutriCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  macroBreakdown: { flex: 1, gap: 10 },
  macroBar: { gap: 4 },
  macroBarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  macroBarLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
  macroBarValue: { fontSize: 11, color: '#888' },
  macroBarTrack: { height: 6, backgroundColor: '#E0E0E0', borderRadius: 3 },
  macroBarFill: { height: 6, borderRadius: 3 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#D4EFD8',
  },
  statChip: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  statLabel: { fontSize: 11, color: '#888' },
  logFabContainer: { marginHorizontal: 16, marginVertical: 16 },
  logFab: { borderRadius: 16, overflow: 'hidden' },
  logFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logFabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  mealsContainer: { paddingHorizontal: 16, gap: 12 },
});
