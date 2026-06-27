import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { db } from '@/services/supabase';
import { supabase } from '@/services/supabase';

const MEDICATION_LABELS: Record<string, string> = {
  semaglutide: 'Semaglutide (Ozempic/Wegovy)',
  tirzepatide: 'Tirzepatide (Mounjaro/Zepbound)',
  liraglutide: 'Liraglutide (Saxenda)',
  bpc157: 'BPC-157',
  other: 'Other',
  none: 'None',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extra_active: 'Extra Active',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, signOut, session } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim(), bio: bio.trim() });
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleChangeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !session?.user.id) return;
    setUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `avatars/${session.user.id}.${ext}`;
      const blob = await (await fetch(uri)).blob();
      await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl });
    } catch {
      Alert.alert('Error', 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const cal = profile?.target_calories ?? 0;
  const protein = profile?.target_protein ?? 0;
  const carbs = profile?.target_carbs ?? 0;
  const fat = profile?.target_fat ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => setEditing(e => !e)}>
            <Ionicons name={editing ? 'close' : 'create-outline'} size={24} color="#1A6B3C" />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleChangeAvatar} disabled={uploadingAvatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={44} color="#CCC" />
              </View>
            )}
            <View style={styles.cameraOverlay}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>

          {editing ? (
            <View style={{ marginTop: 12, width: '100%', gap: 10 }}>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                maxLength={50}
              />
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell the community about yourself…"
                multiline
                maxLength={250}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.name}>{profile?.display_name ?? 'Nouri User'}</Text>
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            </>
          )}
        </View>

        {/* Nutrition targets */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Targets</Text>
          <View style={styles.macroRow}>
            <MacroCell label="Calories" value={`${cal}`} unit="kcal" color="#F59E0B" />
            <MacroCell label="Protein" value={`${protein}g`} color="#1A6B3C" />
            <MacroCell label="Carbs" value={`${carbs}g`} color="#3B82F6" />
            <MacroCell label="Fat" value={`${fat}g`} color="#EF4444" />
          </View>
        </View>

        {/* GLP-1 info */}
        {profile?.is_glp1_user && (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#7C3AED' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="fitness" size={18} color="#7C3AED" />
              <Text style={[styles.cardTitle, { color: '#7C3AED' }]}>GLP-1 / Peptide User</Text>
            </View>
            <Text style={styles.metaText}>
              {profile?.current_medication ? MEDICATION_LABELS[profile.current_medication] ?? profile.current_medication : 'Medication not set'}
            </Text>
            <TouchableOpacity style={styles.glp1Btn} onPress={() => router.push('/glp1')}>
              <Text style={styles.glp1BtnText}>Open GLP-1 Tracker →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Health info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Info</Text>
          <InfoRow icon="body" label="Goal" value={profile?.goal?.replace(/_/g, ' ') ?? '—'} />
          <InfoRow icon="walk" label="Activity" value={ACTIVITY_LABELS[profile?.activity_level ?? ''] ?? '—'} />
          {profile?.weight_kg && <InfoRow icon="scale" label="Weight" value={`${profile.weight_kg} kg`} />}
          {profile?.height_cm && <InfoRow icon="resize" label="Height" value={`${profile.height_cm} cm`} />}
        </View>

        {/* Quick links */}
        <View style={styles.card}>
          <MenuRow icon="bookmark-outline" label="Saved Recipes" onPress={() => router.push('/recipes/saved')} />
          <MenuRow icon="document-text-outline" label="My Recipes" onPress={() => router.push('/recipes/mine')} />
          <MenuRow icon="people-outline" label="Community" onPress={() => router.push('/(tabs)/community')} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroCell({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.macroUnit}>{unit}</Text> : null}
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#999" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color="#1A6B3C" />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#CCC" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  avatarSection: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1A6B3C', borderRadius: 12, padding: 4 },
  name: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginTop: 12 },
  bio: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#666' },
  input: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#1A6B3C', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginTop: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },
  macroValue: { fontSize: 18, fontWeight: '800' },
  macroUnit: { fontSize: 10, color: '#999', marginTop: -2 },
  macroLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  metaText: { fontSize: 13, color: '#666' },
  glp1Btn: { marginTop: 6 },
  glp1BtnText: { color: '#7C3AED', fontWeight: '600', fontSize: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  infoLabel: { flex: 1, fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', textTransform: 'capitalize' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  menuLabel: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 14 },
  signOutText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
