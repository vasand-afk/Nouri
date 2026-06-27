import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalValue, setGoalValue] = useState('');
  const [goalUnit, setGoalUnit] = useState('days');
  const [durationDays, setDurationDays] = useState('30');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim() || !session?.user.id) return;
    setSaving(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (parseInt(durationDays) || 30));
      await db.challenges().insert({
        title: title.trim(),
        description: description.trim() || null,
        goal_value: parseInt(goalValue) || null,
        goal_unit: goalUnit,
        duration_days: parseInt(durationDays) || 30,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        created_by: session.user.id,
        status: 'upcoming',
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not create challenge.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Challenge</Text>
        <TouchableOpacity onPress={create} disabled={saving || !title.trim()} style={[styles.createBtn, (!title.trim() || saving) && { opacity: 0.4 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createText}>Create</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. 30-Day Protein Challenge" maxLength={80} />
        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { minHeight: 100 }]} value={description} onChangeText={setDescription} placeholder="Describe the challenge…" multiline maxLength={500} textAlignVertical="top" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Goal</Text>
            <TextInput style={styles.input} value={goalValue} onChangeText={setGoalValue} placeholder="e.g. 100" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Unit</Text>
            <TextInput style={styles.input} value={goalUnit} onChangeText={setGoalUnit} placeholder="days / grams / etc" />
          </View>
        </View>
        <Text style={styles.label}>Duration (days)</Text>
        <TextInput style={styles.input} value={durationDays} onChangeText={setDurationDays} keyboardType="numeric" placeholder="30" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  createBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  createText: { color: '#fff', fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#FAFAFA', marginBottom: 16 },
});
