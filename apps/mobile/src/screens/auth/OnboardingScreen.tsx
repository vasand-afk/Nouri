import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Dimensions, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInRight, FadeOutLeft, FadeInLeft, FadeOutRight,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../stores/authStore';
import { calculateTargets } from '../../types';

const { width } = Dimensions.get('window');

// ─── Step types ────────────────────────────────────────────

interface OnboardingData {
  // Step 1 — About You
  display_name: string;
  date_of_birth: string;
  sex: 'male' | 'female' | 'other' | '';
  height_cm: string;
  weight_kg: string;

  // Step 2 — Goal & Activity
  goal: string;
  activity_level: string;

  // Step 3 — GLP-1 & Diet
  is_glp1_user: boolean;
  glp1_medication: string;
  glp1_dose_mg: string;
  glp1_start_date: string;
  dietary_preferences: string[];
  allergies: string[];
}

const INITIAL: OnboardingData = {
  display_name: '',
  date_of_birth: '',
  sex: '',
  height_cm: '',
  weight_kg: '',
  goal: '',
  activity_level: '',
  is_glp1_user: false,
  glp1_medication: '',
  glp1_dose_mg: '',
  glp1_start_date: '',
  dietary_preferences: [],
  allergies: [],
};

const GOALS = [
  { key: 'lose_weight', label: 'Lose Weight', icon: '⬇️', desc: 'Calorie deficit, fat loss' },
  { key: 'maintain', label: 'Stay Healthy', icon: '⚖️', desc: 'Maintain current weight' },
  { key: 'gain_muscle', label: 'Build Muscle', icon: '💪', desc: 'Calorie surplus, strength' },
  { key: 'improve_health', label: 'Improve Health', icon: '❤️', desc: 'General wellbeing' },
  { key: 'manage_condition', label: 'Manage Condition', icon: '🏥', desc: 'Diabetes, PCOS, etc.' },
];

const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { key: 'light', label: 'Light', desc: '1–2 workouts/week' },
  { key: 'moderate', label: 'Moderate', desc: '3–4 workouts/week' },
  { key: 'active', label: 'Active', desc: '5–6 workouts/week' },
  { key: 'very_active', label: 'Very Active', desc: 'Physical job or 2x/day training' },
];

const GLP1_MEDICATIONS = [
  'Semaglutide (Ozempic)', 'Semaglutide (Wegovy)', 'Tirzepatide (Mounjaro)',
  'Tirzepatide (Zepbound)', 'Liraglutide (Saxenda)', 'Dulaglutide (Trulicity)',
  'BPC-157', 'TB-500', 'Ipamorelin/CJC-1295', 'Other',
];

const DIETARY_PREFS = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Keto / Low-carb',
  'Paleo', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher',
];

const ALLERGIES = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { session, updateProfile } = useAuthStore();
  const [step, setStep] = useState(0); // 0=About, 1=Goal, 2=GLP1+Diet, 3=Macros
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [isSaving, setIsSaving] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const totalSteps = 4;

  const go = (newStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection(newStep > step ? 'forward' : 'back');
    setStep(newStep);
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!data.display_name.trim()) { Alert.alert('Missing', 'Please enter your name.'); return false; }
      if (!data.sex) { Alert.alert('Missing', 'Please select your biological sex (needed for calorie calculations).'); return false; }
      if (!data.height_cm || !data.weight_kg) { Alert.alert('Missing', 'Height and weight are needed to calculate your targets.'); return false; }
    }
    if (step === 1) {
      if (!data.goal) { Alert.alert('Missing', 'Please select a goal.'); return false; }
      if (!data.activity_level) { Alert.alert('Missing', 'Please select your activity level.'); return false; }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < totalSteps - 1) go(step + 1);
  };

  const back = () => {
    if (step > 0) go(step - 1);
  };

  const save = async () => {
    if (!session?.user.id) return;
    setIsSaving(true);

    const targets = calculateTargets({
      weight_kg: parseFloat(data.weight_kg) || 70,
      height_cm: parseFloat(data.height_cm) || 170,
      date_of_birth: data.date_of_birth || undefined,
      sex: data.sex || 'other',
      goal: (data.goal as any) || 'maintain',
      activity_level: (data.activity_level as any) || 'moderate',
      is_glp1_user: data.is_glp1_user,
    });

    await updateProfile({
      display_name: data.display_name.trim(),
      date_of_birth: data.date_of_birth || null,
      sex: (data.sex as any) || null,
      height_cm: parseFloat(data.height_cm) || null,
      weight_kg: parseFloat(data.weight_kg) || null,
      goal: (data.goal as any) || null,
      activity_level: (data.activity_level as any) || null,
      is_glp1_user: data.is_glp1_user,
      glp1_medication: data.glp1_medication || null,
      glp1_dose_mg: parseFloat(data.glp1_dose_mg) || null,
      glp1_start_date: data.glp1_start_date || null,
      dietary_preferences: data.dietary_preferences,
      allergies: data.allergies,
      daily_calories_target: targets.calories,
      protein_target_g: targets.protein_g,
      carbs_target_g: targets.carbs_g,
      fat_target_g: targets.fat_g,
    });

    setIsSaving(false);
    router.replace('/(tabs)');
  };

  const computedTargets = calculateTargets({
    weight_kg: parseFloat(data.weight_kg) || 70,
    height_cm: parseFloat(data.height_cm) || 170,
    date_of_birth: data.date_of_birth || undefined,
    sex: (data.sex as any) || 'other',
    goal: (data.goal as any) || 'maintain',
    activity_level: (data.activity_level as any) || 'moderate',
    is_glp1_user: data.is_glp1_user,
  });

  const [adjustedTargets, setAdjustedTargets] = useState(computedTargets);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      {/* Back button */}
      {step > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Ionicons name="chevron-back" size={24} color="#555" />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 0: About You ─────────────────────────── */}
          {step === 0 && (
            <Animated.View entering={direction === 'forward' ? FadeInRight.duration(300) : FadeInLeft.duration(300)}>
              <StepHeader
                step={1}
                total={totalSteps}
                title="Let's get to know you"
                subtitle="We use this to calculate your personalized nutrition targets"
              />

              <Field label="Your name">
                <TextInput
                  style={styles.input}
                  placeholder="Display name"
                  value={data.display_name}
                  onChangeText={(v) => setData({ ...data, display_name: v })}
                  autoFocus
                />
              </Field>

              <Field label="Date of birth (optional)">
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={data.date_of_birth}
                  onChangeText={(v) => setData({ ...data, date_of_birth: v })}
                  keyboardType="numbers-and-punctuation"
                />
              </Field>

              <Field label="Biological sex (for calorie calculation)">
                <View style={styles.chipRow}>
                  {(['male', 'female', 'other'] as const).map((s) => (
                    <Chip
                      key={s}
                      label={s.charAt(0).toUpperCase() + s.slice(1)}
                      active={data.sex === s}
                      onPress={() => setData({ ...data, sex: s })}
                    />
                  ))}
                </View>
              </Field>

              <View style={styles.row}>
                <Field label="Height (cm)" style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 172"
                    value={data.height_cm}
                    onChangeText={(v) => setData({ ...data, height_cm: v })}
                    keyboardType="decimal-pad"
                  />
                </Field>
                <Field label="Weight (kg)" style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 78"
                    value={data.weight_kg}
                    onChangeText={(v) => setData({ ...data, weight_kg: v })}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
            </Animated.View>
          )}

          {/* ── Step 1: Goal & Activity ────────────────────── */}
          {step === 1 && (
            <Animated.View entering={direction === 'forward' ? FadeInRight.duration(300) : FadeInLeft.duration(300)}>
              <StepHeader
                step={2}
                total={totalSteps}
                title="What's your goal?"
                subtitle="Nouri will tailor your daily targets and AI advice to this"
              />

              <Field label="Primary goal">
                <View style={styles.goalGrid}>
                  {GOALS.map((g) => (
                    <TouchableOpacity
                      key={g.key}
                      style={[styles.goalCard, data.goal === g.key && styles.goalCardActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setData({ ...data, goal: g.key });
                      }}
                    >
                      <Text style={styles.goalEmoji}>{g.icon}</Text>
                      <Text style={[styles.goalLabel, data.goal === g.key && styles.goalLabelActive]}>
                        {g.label}
                      </Text>
                      <Text style={styles.goalDesc}>{g.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>

              <Field label="Activity level">
                {ACTIVITY_LEVELS.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.activityRow, data.activity_level === a.key && styles.activityRowActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setData({ ...data, activity_level: a.key });
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityLabel, data.activity_level === a.key && styles.activityLabelActive]}>
                        {a.label}
                      </Text>
                      <Text style={styles.activityDesc}>{a.desc}</Text>
                    </View>
                    {data.activity_level === a.key && (
                      <Ionicons name="checkmark-circle" size={22} color="#1A6B3C" />
                    )}
                  </TouchableOpacity>
                ))}
              </Field>
            </Animated.View>
          )}

          {/* ── Step 2: GLP-1 + Diet ──────────────────────── */}
          {step === 2 && (
            <Animated.View entering={direction === 'forward' ? FadeInRight.duration(300) : FadeInLeft.duration(300)}>
              <StepHeader
                step={3}
                total={totalSteps}
                title="Medication & diet"
                subtitle="Nouri gives specialized guidance for GLP-1 and peptide users"
              />

              <Field label="Are you using GLP-1s or peptides?">
                <View style={styles.chipRow}>
                  <Chip
                    label="Yes"
                    active={data.is_glp1_user}
                    onPress={() => setData({ ...data, is_glp1_user: true })}
                  />
                  <Chip
                    label="No"
                    active={!data.is_glp1_user}
                    onPress={() => setData({ ...data, is_glp1_user: false })}
                  />
                </View>
              </Field>

              {data.is_glp1_user && (
                <>
                  <Field label="Medication">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {GLP1_MEDICATIONS.map((m) => (
                          <Chip
                            key={m}
                            label={m.split(' ')[0]}
                            active={data.glp1_medication === m}
                            onPress={() => setData({ ...data, glp1_medication: m })}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </Field>

                  <View style={styles.row}>
                    <Field label="Dose (mg)" style={{ flex: 1 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 0.5"
                        value={data.glp1_dose_mg}
                        onChangeText={(v) => setData({ ...data, glp1_dose_mg: v })}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                    <Field label="Start date" style={{ flex: 1 }}>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={data.glp1_start_date}
                        onChangeText={(v) => setData({ ...data, glp1_start_date: v })}
                        keyboardType="numbers-and-punctuation"
                      />
                    </Field>
                  </View>
                </>
              )}

              <Field label="Dietary preferences (optional)">
                <View style={styles.chipWrap}>
                  {DIETARY_PREFS.map((p) => (
                    <Chip
                      key={p}
                      label={p}
                      active={data.dietary_preferences.includes(p)}
                      onPress={() => {
                        const prefs = data.dietary_preferences.includes(p)
                          ? data.dietary_preferences.filter((x) => x !== p)
                          : [...data.dietary_preferences, p];
                        setData({ ...data, dietary_preferences: prefs });
                      }}
                    />
                  ))}
                </View>
              </Field>

              <Field label="Allergies (optional)">
                <View style={styles.chipWrap}>
                  {ALLERGIES.map((a) => (
                    <Chip
                      key={a}
                      label={a}
                      active={data.allergies.includes(a)}
                      color="#DC2626"
                      onPress={() => {
                        const all = data.allergies.includes(a)
                          ? data.allergies.filter((x) => x !== a)
                          : [...data.allergies, a];
                        setData({ ...data, allergies: all });
                      }}
                    />
                  ))}
                </View>
              </Field>
            </Animated.View>
          )}

          {/* ── Step 3: Macro Review ──────────────────────── */}
          {step === 3 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <StepHeader
                step={4}
                total={totalSteps}
                title="Your daily targets"
                subtitle="Calculated based on your profile. You can adjust these anytime."
              />

              {data.is_glp1_user && (
                <View style={styles.glp1Notice}>
                  <Ionicons name="medical" size={18} color="#7C3AED" />
                  <Text style={styles.glp1NoticeText}>
                    GLP-1 mode: protein target elevated to preserve muscle while appetite is suppressed.
                  </Text>
                </View>
              )}

              <View style={styles.macroCard}>
                <MacroAdjuster
                  label="Calories"
                  value={computedTargets.calories}
                  unit="kcal"
                  color="#FF9800"
                  step={50}
                  onChangeValue={(v) => setAdjustedTargets({ ...adjustedTargets, calories: v })}
                />
                <MacroAdjuster
                  label="Protein"
                  value={computedTargets.protein_g}
                  unit="g"
                  color="#4CAF50"
                  step={5}
                  onChangeValue={(v) => setAdjustedTargets({ ...adjustedTargets, protein_g: v })}
                />
                <MacroAdjuster
                  label="Carbs"
                  value={computedTargets.carbs_g}
                  unit="g"
                  color="#2196F3"
                  step={5}
                  onChangeValue={(v) => setAdjustedTargets({ ...adjustedTargets, carbs_g: v })}
                />
                <MacroAdjuster
                  label="Fat"
                  value={computedTargets.fat_g}
                  unit="g"
                  color="#9C27B0"
                  step={5}
                  onChangeValue={(v) => setAdjustedTargets({ ...adjustedTargets, fat_g: v })}
                />
              </View>

              <View style={styles.calBreakdown}>
                <Text style={styles.calBreakdownText}>
                  {adjustedTargets.protein_g * 4 + adjustedTargets.carbs_g * 4 + adjustedTargets.fat_g * 9} kcal
                  from macros vs {adjustedTargets.calories} kcal target
                </Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.cta, isSaving && styles.ctaDisabled]}
            onPress={step < totalSteps - 1 ? next : save}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.ctaGradient}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.ctaText}>
                    {step < totalSteps - 1 ? 'Continue' : "Let's go →"}
                  </Text>
                  {step < totalSteps - 1 && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────

function StepHeader({
  step, total, title, subtitle,
}: { step: number; total: number; title: string; subtitle: string }) {
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepCounter}>Step {step} of {total}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Field({
  label, children, style,
}: {
  label: string; children: React.ReactNode; style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label, active, onPress, color = '#1A6B3C',
}: {
  label: string; active: boolean; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MacroAdjuster({
  label, value, unit, color, step: s, onChangeValue,
}: {
  label: string; value: number; unit: string; color: string; step: number;
  onChangeValue: (v: number) => void;
}) {
  const [val, setVal] = useState(value);

  const update = (newVal: number) => {
    setVal(newVal);
    onChangeValue(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.adjusterRow}>
      <View style={[styles.adjusterDot, { backgroundColor: color }]} />
      <Text style={styles.adjusterLabel}>{label}</Text>
      <View style={styles.adjusterControls}>
        <TouchableOpacity onPress={() => update(Math.max(0, val - s))} style={styles.adjusterBtn}>
          <Ionicons name="remove" size={18} color="#555" />
        </TouchableOpacity>
        <Text style={styles.adjusterValue}>{val}{unit}</Text>
        <TouchableOpacity onPress={() => update(val + s)} style={styles.adjusterBtn}>
          <Ionicons name="add" size={18} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  progressDot: {
    width: 24, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0',
  },
  progressDotActive: { backgroundColor: '#1A6B3C' },
  backBtn: { position: 'absolute', top: 52, left: 16, zIndex: 10, padding: 8 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },

  stepHeader: { marginBottom: 28 },
  stepCounter: { fontSize: 12, color: '#1A6B3C', fontWeight: '700', marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#1A1A1A', lineHeight: 32 },
  stepSubtitle: { fontSize: 14, color: '#777', marginTop: 8, lineHeight: 20 },

  field: { marginBottom: 22 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'nowrap' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: {
    width: '47%',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FAFAFA',
  },
  goalCardActive: { borderColor: '#1A6B3C', backgroundColor: '#F0FBF5' },
  goalEmoji: { fontSize: 24, marginBottom: 6 },
  goalLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  goalLabelActive: { color: '#1A6B3C' },
  goalDesc: { fontSize: 11, color: '#999', marginTop: 2 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  activityRowActive: { borderColor: '#1A6B3C', backgroundColor: '#F0FBF5' },
  activityLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  activityLabelActive: { color: '#1A6B3C' },
  activityDesc: { fontSize: 12, color: '#999', marginTop: 2 },

  glp1Notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F5F0FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  glp1NoticeText: { flex: 1, fontSize: 13, color: '#4C1D95', lineHeight: 18 },

  macroCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    gap: 4,
  },
  adjusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  adjusterDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  adjusterLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  adjusterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjusterBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  adjusterValue: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', minWidth: 64, textAlign: 'center' },

  calBreakdown: { marginTop: 12, alignItems: 'center' },
  calBreakdownText: { fontSize: 12, color: '#999' },

  ctaContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  cta: { borderRadius: 16, overflow: 'hidden' },
  ctaDisabled: { opacity: 0.7 },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 8,
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
