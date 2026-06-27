import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, differenceInDays, addDays } from 'date-fns';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '../../stores/authStore';
import { db } from '../../services/supabase';
import { InjectionLog, SideEffectLog } from '@nouri/shared/types';
import SideEffectSlider from '../../components/glp1/SideEffectSlider';
import InjectionCard from '../../components/glp1/InjectionCard';
import ProteinGoalBanner from '../../components/glp1/ProteinGoalBanner';

const GLP1_MEDICATIONS = [
  { name: 'Semaglutide (Ozempic/Wegovy)', type: 'glp1', frequency_days: 7 },
  { name: 'Tirzepatide (Mounjaro/Zepbound)', type: 'glp1', frequency_days: 7 },
  { name: 'Liraglutide (Saxenda)', type: 'glp1', frequency_days: 1 },
  { name: 'Dulaglutide (Trulicity)', type: 'glp1', frequency_days: 7 },
  { name: 'BPC-157', type: 'peptide', frequency_days: 1 },
  { name: 'TB-500', type: 'peptide', frequency_days: 3 },
  { name: 'Ipamorelin/CJC-1295', type: 'peptide', frequency_days: 1 },
  { name: 'AOD-9604', type: 'peptide', frequency_days: 1 },
  { name: 'Custom', type: 'other', frequency_days: 7 },
];

export default function GLP1TrackerScreen() {
  const { session, profile } = useAuthStore();
  const [injections, setInjections] = useState<InjectionLog[]>([]);
  const [sideEffects, setSideEffects] = useState<SideEffectLog[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSideEffectModal, setShowSideEffectModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New injection form
  const [newInjection, setNewInjection] = useState({
    medication: profile?.glp1_medication ?? GLP1_MEDICATIONS[0].name,
    dose_mg: profile?.glp1_dose_mg?.toString() ?? '',
    injection_site: 'abdomen',
    notes: '',
  });

  // Side effect form
  const [effects, setEffects] = useState({
    nausea: 0, fatigue: 0, appetite_level: 5, energy_level: 5, mood: 5, notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!session?.user.id) return;

    const [injectionsRes, effectsRes] = await Promise.all([
      db.injections()
        .select('*')
        .eq('user_id', session.user.id)
        .order('injected_at', { ascending: false })
        .limit(20),
      db.sideEffects()
        .select('*')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false })
        .limit(10),
    ]);

    setInjections((injectionsRes.data ?? []) as InjectionLog[]);
    setSideEffects((effectsRes.data ?? []) as SideEffectLog[]);
    setIsLoading(false);
  };

  const logInjection = async () => {
    if (!session?.user.id) return;

    const med = GLP1_MEDICATIONS.find(m => m.name === newInjection.medication);
    const nextDose = addDays(new Date(), med?.frequency_days ?? 7);

    const { data } = await db.injections()
      .insert({
        user_id: session.user.id,
        medication: newInjection.medication,
        medication_type: med?.type ?? 'glp1',
        dose_mg: parseFloat(newInjection.dose_mg) || null,
        injection_site: newInjection.injection_site,
        next_dose_at: nextDose.toISOString(),
        notes: newInjection.notes || null,
        injected_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (data) {
      setInjections([data as InjectionLog, ...injections]);

      // Schedule push notification for next dose
      await scheduleInjectionReminder(nextDose, newInjection.medication);
    }

    setShowLogModal(false);
  };

  const scheduleInjectionReminder = async (date: Date, medication: string) => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const reminderDate = new Date(date);
    reminderDate.setHours(9, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💉 Injection Reminder',
        body: `Time for your ${medication} dose today`,
        data: { screen: 'glp1' },
      },
      trigger: { date: reminderDate },
    });
  };

  const logSideEffects = async () => {
    if (!session?.user.id) return;

    const lastInjection = injections[0];

    const { data } = await db.sideEffects()
      .insert({
        user_id: session.user.id,
        ...effects,
        injection_log_id: lastInjection?.id ?? null,
        logged_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (data) setSideEffects([data as SideEffectLog, ...sideEffects]);
    setShowSideEffectModal(false);
  };

  const lastInjection = injections[0];
  const nextDue = lastInjection?.next_dose_at ? new Date(lastInjection.next_dose_at) : null;
  const daysUntilNext = nextDue ? differenceInDays(nextDue, new Date()) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>GLP-1 & Peptide Tracker</Text>
          <TouchableOpacity
            style={styles.logBtn}
            onPress={() => setShowLogModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.logBtnText}>Log Dose</Text>
          </TouchableOpacity>
        </View>

        {/* Next dose banner */}
        {nextDue && (
          <LinearGradient
            colors={daysUntilNext === 0 ? ['#DC2626', '#EF4444'] : ['#1A6B3C', '#27A85F']}
            style={styles.nextDoseBanner}
          >
            <View style={styles.nextDoseInfo}>
              <Ionicons name="time" size={24} color="#fff" />
              <View>
                <Text style={styles.nextDoseLabel}>Next Dose</Text>
                <Text style={styles.nextDoseDate}>
                  {daysUntilNext === 0
                    ? 'Today!'
                    : daysUntilNext === 1
                    ? 'Tomorrow'
                    : `In ${daysUntilNext} days (${format(nextDue, 'MMM d')})`}
                </Text>
              </View>
            </View>
            <Text style={styles.nextDoseMed}>
              {lastInjection?.medication?.split(' ')[0]}
            </Text>
          </LinearGradient>
        )}

        {/* Protein priority card */}
        <ProteinGoalBanner
          proteinTarget={profile?.protein_target_g ?? 120}
          isGlp1User={profile?.is_glp1_user ?? false}
        />

        {/* Progress summary */}
        {profile?.glp1_start_date && (
          <View style={styles.progressCard}>
            <Text style={styles.cardTitle}>Your Journey</Text>
            <View style={styles.statsRow}>
              <StatBox
                value={differenceInDays(new Date(), new Date(profile.glp1_start_date)).toString()}
                label="Days on medication"
                icon="calendar"
              />
              <StatBox
                value={injections.length.toString()}
                label="Total doses"
                icon="medical"
              />
              <StatBox
                value={`${Math.round(injections.length / Math.max(1, differenceInDays(new Date(), new Date(profile.glp1_start_date)) / 7))}x`}
                label="Avg doses/week"
                icon="repeat"
              />
            </View>
          </View>
        )}

        {/* Side effects trend */}
        {sideEffects.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Wellbeing Trends</Text>
              <TouchableOpacity onPress={() => setShowSideEffectModal(true)}>
                <Text style={styles.addLink}>+ Log Today</Text>
              </TouchableOpacity>
            </View>
            <SideEffectChart data={sideEffects.slice(0, 7).reverse()} />
          </View>
        )}

        {sideEffects.length === 0 && (
          <TouchableOpacity
            style={styles.sideEffectCTA}
            onPress={() => setShowSideEffectModal(true)}
          >
            <Ionicons name="heart-half" size={24} color="#7C3AED" />
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Track how you're feeling</Text>
              <Text style={styles.ctaSubtitle}>Log nausea, energy, appetite and mood after each dose</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        )}

        {/* Injection history */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Injection History</Text>
          {injections.map((inj) => (
            <InjectionCard key={inj.id} injection={inj} />
          ))}
          {injections.length === 0 && (
            <Text style={styles.emptyText}>No injections logged yet. Tap "Log Dose" above to start.</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Log Injection Modal */}
      <Modal visible={showLogModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLogModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Log Injection</Text>
            <TouchableOpacity onPress={logInjection}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>Medication</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {GLP1_MEDICATIONS.map((med) => (
                <TouchableOpacity
                  key={med.name}
                  style={[
                    styles.medChip,
                    newInjection.medication === med.name && styles.medChipActive,
                  ]}
                  onPress={() => setNewInjection({ ...newInjection, medication: med.name })}
                >
                  <Text style={[
                    styles.medChipText,
                    newInjection.medication === med.name && styles.medChipTextActive,
                  ]}>
                    {med.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Dose (mg)</Text>
            <TextInput
              style={styles.fieldInput}
              value={newInjection.dose_mg}
              onChangeText={(t) => setNewInjection({ ...newInjection, dose_mg: t })}
              keyboardType="decimal-pad"
              placeholder="e.g. 0.5"
            />

            <Text style={styles.fieldLabel}>Injection Site</Text>
            <View style={styles.siteRow}>
              {['abdomen', 'thigh', 'arm'].map((site) => (
                <TouchableOpacity
                  key={site}
                  style={[styles.siteChip, newInjection.injection_site === site && styles.siteChipActive]}
                  onPress={() => setNewInjection({ ...newInjection, injection_site: site })}
                >
                  <Text style={[styles.siteText, newInjection.injection_site === site && { color: '#fff' }]}>
                    {site}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80 }]}
              value={newInjection.notes}
              onChangeText={(t) => setNewInjection({ ...newInjection, notes: t })}
              placeholder="Side effects, how you're feeling..."
              multiline
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Side Effect Modal */}
      <Modal visible={showSideEffectModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSideEffectModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>How are you feeling?</Text>
            <TouchableOpacity onPress={logSideEffects}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <SideEffectSlider
              label="Nausea"
              emoji="🤢"
              value={effects.nausea}
              onChange={(v) => setEffects({ ...effects, nausea: v })}
              lowLabel="None"
              highLabel="Severe"
            />
            <SideEffectSlider
              label="Fatigue"
              emoji="😴"
              value={effects.fatigue}
              onChange={(v) => setEffects({ ...effects, fatigue: v })}
              lowLabel="None"
              highLabel="Exhausted"
            />
            <SideEffectSlider
              label="Appetite"
              emoji="🍽️"
              value={effects.appetite_level}
              onChange={(v) => setEffects({ ...effects, appetite_level: v })}
              lowLabel="Suppressed"
              highLabel="Normal"
            />
            <SideEffectSlider
              label="Energy"
              emoji="⚡"
              value={effects.energy_level}
              onChange={(v) => setEffects({ ...effects, energy_level: v })}
              lowLabel="Low"
              highLabel="High"
            />
            <SideEffectSlider
              label="Mood"
              emoji="😊"
              value={effects.mood}
              onChange={(v) => setEffects({ ...effects, mood: v })}
              lowLabel="Low"
              highLabel="Great"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ value, label, icon }: { value: string; label: string; icon: any }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color="#1A6B3C" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SideEffectChart({ data }: { data: SideEffectLog[] }) {
  return (
    <View style={styles.chartContainer}>
      {['nausea', 'energy_level', 'mood'].map((metric) => (
        <View key={metric} style={styles.chartRow}>
          <Text style={styles.chartLabel}>{metric.replace('_', ' ')}</Text>
          <View style={styles.chartBars}>
            {data.map((d, i) => {
              const val = (d as any)[metric] as number;
              return (
                <View key={i} style={styles.chartBarWrapper}>
                  <View style={[styles.chartBar, { height: Math.max(4, val * 4) }]} />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A6B3C',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  nextDoseBanner: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextDoseInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextDoseLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  nextDoseDate: { color: '#fff', fontSize: 18, fontWeight: '800' },
  nextDoseMed: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  progressCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1A6B3C' },
  statLabel: { fontSize: 11, color: '#888', textAlign: 'center' },
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  addLink: { color: '#1A6B3C', fontWeight: '600', fontSize: 14 },
  sideEffectCTA: {
    marginHorizontal: 16,
    backgroundColor: '#F5F0FF',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  ctaSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  cancelText: { fontSize: 16, color: '#999' },
  saveText: { fontSize: 16, color: '#1A6B3C', fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  medChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  medChipActive: { backgroundColor: '#1A6B3C' },
  medChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  medChipTextActive: { color: '#fff' },
  siteRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  siteChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  siteChipActive: { backgroundColor: '#1A6B3C' },
  siteText: { fontSize: 14, color: '#555', fontWeight: '600', textTransform: 'capitalize' },
  chartContainer: { gap: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chartLabel: { width: 80, fontSize: 12, color: '#666', textTransform: 'capitalize' },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 },
  chartBarWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '80%', backgroundColor: '#1A6B3C', borderRadius: 3 },
});
