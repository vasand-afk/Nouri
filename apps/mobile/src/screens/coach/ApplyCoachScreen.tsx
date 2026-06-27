import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { db } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

const SPECIALTIES = [
  'weight_loss', 'glp1_support', 'sports_nutrition', 'eating_disorders',
  'diabetes', 'plant_based', 'digestive_health', 'womens_health',
  'pediatric_nutrition', 'oncology_nutrition',
];

const SESSION_TYPES = ['video', 'chat', 'async_review'];

export default function ApplyCoachScreen() {
  const router = useRouter();
  const { session, profile, updateProfile } = useAuthStore();

  const [bio, setBio] = useState('');
  const [credentials, setCredentials] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [sessionTypes, setSessionTypes] = useState<string[]>(['chat']);
  const [isAccepting, setIsAccepting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const toggle = <T extends string>(arr: T[], val: T, setArr: (a: T[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const submit = async () => {
    if (!bio.trim()) { Alert.alert('Missing', 'Please add a bio.'); return; }
    if (specialties.length === 0) { Alert.alert('Missing', 'Select at least one specialty.'); return; }
    if (!session?.user.id) return;

    setIsSaving(true);

    // Check if coach profile already exists
    const { data: existing } = await db.coaches()
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const coachData = {
      user_id: session.user.id,
      bio: bio.trim(),
      credentials: credentials.trim() || null,
      years_experience: parseInt(yearsExp) || null,
      hourly_rate_usd: parseFloat(hourlyRate) || null,
      specialties,
      session_types: sessionTypes,
      is_accepting_clients: isAccepting,
    };

    if (existing) {
      await db.coaches().update(coachData).eq('id', existing.id);
    } else {
      await db.coaches().insert(coachData);
    }

    // Mark user as coach in profile
    await updateProfile({ is_coach: true });

    setIsSaving(false);
    Alert.alert(
      'Application submitted!',
      'Our team will review your credentials and verify your profile within 2–3 business days.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Become a Coach</Text>
          <TouchableOpacity
            style={[styles.submitBtn, isSaving && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>Apply</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroBanner}>
            <Text style={styles.heroEmoji}>🏅</Text>
            <Text style={styles.heroTitle}>Join our coach network</Text>
            <Text style={styles.heroSubtitle}>
              Connect with clients, share your expertise, and earn income helping people reach their nutrition goals.
            </Text>
          </View>

          {/* Bio */}
          <Field label="Your bio *">
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Describe your approach, philosophy, and who you help best..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />
          </Field>

          {/* Credentials */}
          <Field label="Credentials / certifications">
            <TextInput
              style={styles.input}
              placeholder="e.g. RD, RDN, CNS, CPT, CSCS..."
              value={credentials}
              onChangeText={setCredentials}
            />
          </Field>

          <View style={styles.row}>
            <Field label="Years experience" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={yearsExp}
                onChangeText={setYearsExp}
                keyboardType="number-pad"
                placeholder="3"
              />
            </Field>
            <Field label="Hourly rate (USD)" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                keyboardType="decimal-pad"
                placeholder="e.g. 75"
              />
            </Field>
          </View>

          {/* Specialties */}
          <Field label="Specialties * (select all that apply)">
            <View style={styles.chipWrap}>
              {SPECIALTIES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, specialties.includes(s) && styles.chipActive]}
                  onPress={() => toggle(specialties, s, setSpecialties)}
                >
                  <Text style={[styles.chipText, specialties.includes(s) && styles.chipTextActive]}>
                    {s.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {/* Session types */}
          <Field label="How you work with clients">
            {SESSION_TYPES.map(t => {
              const icons: Record<string, any> = { video: 'videocam', chat: 'chatbubble', async_review: 'document-text' };
              const labels: Record<string, string> = {
                video: 'Video calls',
                chat: 'Live chat / messaging',
                async_review: 'Async diary review',
              };
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.sessionRow, sessionTypes.includes(t) && styles.sessionRowActive]}
                  onPress={() => toggle(sessionTypes, t, setSessionTypes)}
                >
                  <Ionicons name={icons[t]} size={18} color={sessionTypes.includes(t) ? '#1A6B3C' : '#AAA'} />
                  <Text style={[styles.sessionLabel, sessionTypes.includes(t) && styles.sessionLabelActive]}>
                    {labels[t]}
                  </Text>
                  {sessionTypes.includes(t) && <Ionicons name="checkmark-circle" size={18} color="#1A6B3C" />}
                </TouchableOpacity>
              );
            })}
          </Field>

          {/* Accepting clients */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Currently accepting clients</Text>
              <Text style={styles.switchHint}>You can pause this anytime</Text>
            </View>
            <Switch
              value={isAccepting}
              onValueChange={setIsAccepting}
              trackColor={{ true: '#1A6B3C', false: '#DDD' }}
            />
          </View>

          {/* What happens next */}
          <View style={styles.nextStepsBox}>
            <Text style={styles.nextStepsTitle}>What happens next</Text>
            {[
              'Our team reviews your application (2–3 business days)',
              'You\'ll receive a verified badge on your profile',
              'You can start accepting client requests immediately',
              'Payments are handled via Stripe — you keep 85%',
            ].map((step, i) => (
              <View key={i} style={styles.nextStepRow}>
                <View style={styles.nextStepNum}>
                  <Text style={styles.nextStepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.nextStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#1A6B3C', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  submitBtnDisabled: { backgroundColor: '#A5D6B7' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: 20, paddingBottom: 60 },
  heroBanner: {
    backgroundColor: '#F0FBF5', borderRadius: 18, padding: 20,
    alignItems: 'center', marginBottom: 24,
  },
  heroEmoji: { fontSize: 44, marginBottom: 10 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#EBEBEB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#1A1A1A', backgroundColor: '#FAFAFA',
  },
  textarea: { height: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA',
  },
  chipActive: { borderColor: '#1A6B3C', backgroundColor: '#F0FBF5' },
  chipText: { fontSize: 12, color: '#555', fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#1A6B3C' },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E0E0',
    marginBottom: 8, backgroundColor: '#FAFAFA',
  },
  sessionRowActive: { borderColor: '#1A6B3C', backgroundColor: '#F0FBF5' },
  sessionLabel: { flex: 1, fontSize: 14, color: '#555', fontWeight: '500' },
  sessionLabelActive: { color: '#1A6B3C', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F8F8F8', borderRadius: 14, padding: 16, marginBottom: 24,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  switchHint: { fontSize: 12, color: '#999', marginTop: 2 },
  nextStepsBox: { backgroundColor: '#F0FBF5', borderRadius: 16, padding: 18 },
  nextStepsTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 14 },
  nextStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  nextStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#1A6B3C', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nextStepNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  nextStepText: { flex: 1, fontSize: 13, color: '#333', lineHeight: 19 },
});
