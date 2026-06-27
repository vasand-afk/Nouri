import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

const TYPES = ['general', 'glp1', 'recipe', 'progress', 'question'] as const;

export default function NewPostScreen() {
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<typeof TYPES[number]>('general');
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!content.trim() || !session?.user.id) return;
    setPosting(true);
    try {
      await db.posts().insert({
        user_id: session.user.id,
        title: title.trim() || null,
        content: content.trim(),
        post_type: type,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not post. Please try again.');
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity onPress={submit} disabled={posting || !content.trim()} style={[styles.postBtn, (!content.trim() || posting) && { opacity: 0.4 }]}>
          {posting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Give your post a title…"
          maxLength={100}
        />
        <Text style={styles.label}>Content *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content}
          onChangeText={setContent}
          placeholder="Share with the Nouri community…"
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{content.length}/2000</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  postBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  postBtnText: { color: '#fff', fontWeight: '700' },
  body: { padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#FAFAFA', marginBottom: 16 },
  textArea: { minHeight: 180 },
  charCount: { fontSize: 11, color: '#CCC', textAlign: 'right', marginTop: -12, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
});
