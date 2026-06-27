import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      db.posts().select('*, profiles(display_name, avatar_url)').eq('id', id).single(),
      db.postComments().select('*, profiles(display_name, avatar_url)').eq('post_id', id).order('created_at'),
    ]).then(([{ data: p }, { data: c }]) => {
      setPost(p);
      setComments(c ?? []);
      setLoading(false);
    });
  }, [id]);

  const submitComment = async () => {
    if (!comment.trim() || !session?.user.id || !id) return;
    setPosting(true);
    const { data } = await db.postComments().insert({
      post_id: id,
      user_id: session.user.id,
      content: comment.trim(),
    }).select('*, profiles(display_name, avatar_url)').single();
    if (data) setComments(c => [...c, data]);
    setComment('');
    setPosting(false);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1A6B3C" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Post</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {post && (
            <View style={styles.postCard}>
              <Text style={styles.author}>{post.profiles?.display_name ?? 'User'}</Text>
              {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}
              <Text style={styles.postBody}>{post.content}</Text>
              <Text style={styles.postTime}>{new Date(post.created_at).toLocaleDateString()}</Text>
            </View>
          )}
          <Text style={styles.commentsHeader}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</Text>
          {comments.map(c => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.commentAuthor}>{c.profiles?.display_name ?? 'User'}</Text>
              <Text style={styles.commentText}>{c.content}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment…"
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <TouchableOpacity onPress={submitComment} disabled={posting || !comment.trim()} style={styles.sendBtn}>
            {posting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  topTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  postCard: { backgroundColor: '#F8F9FA', borderRadius: 14, padding: 16, marginBottom: 16 },
  author: { fontSize: 13, fontWeight: '700', color: '#1A6B3C', marginBottom: 6 },
  postTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  postBody: { fontSize: 15, color: '#333', lineHeight: 22 },
  postTime: { fontSize: 11, color: '#999', marginTop: 10 },
  commentsHeader: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 12 },
  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#1A6B3C', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#333' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  sendBtn: { backgroundColor: '#1A6B3C', borderRadius: 22, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
