import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

const CATEGORIES = ['glp1', 'weight_loss', 'muscle_gain', 'recipes', 'general', 'support'];

export default function CreateGroupScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim() || !session?.user.id) return;
    setSaving(true);
    try {
      const { data } = await db.groups().insert({
        name: name.trim(),
        description: description.trim() || null,
        category,
        is_private: isPrivate,
        created_by: session.user.id,
      }).select().single();
      if (data) {
        await db.groupMembers().insert({ group_id: data.id, user_id: session.user.id, role: 'admin' });
        router.replace(`/community/groups/${data.id}`);
      }
    } catch {
      Alert.alert('Error', 'Could not create group.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Group</Text>
        <TouchableOpacity onPress={create} disabled={saving || !name.trim()} style={[styles.createBtn, (!name.trim() || saving) && { opacity: 0.4 }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createText}>Create</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
        <Text style={styles.label}>Group name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. GLP-1 Warriors" maxLength={60} />
        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { minHeight: 100 }]} value={description} onChangeText={setDescription} placeholder="What is this group about?" multiline maxLength={500} textAlignVertical="top" />
        <Text style={styles.label}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.toggleRow} onPress={() => setIsPrivate(p => !p)}>
          <Ionicons name={isPrivate ? 'lock-closed' : 'globe-outline'} size={20} color={isPrivate ? '#7C3AED' : '#1A6B3C'} />
          <Text style={styles.toggleText}>{isPrivate ? 'Private group' : 'Public group'}</Text>
          <Ionicons name={isPrivate ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={isPrivate ? '#7C3AED' : '#CCC'} />
        </TouchableOpacity>
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
  chip: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  chipText: { fontSize: 13, color: '#666', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14 },
  toggleText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
});
