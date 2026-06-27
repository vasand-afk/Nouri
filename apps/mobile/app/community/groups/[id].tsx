import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuthStore();
  const [group, setGroup] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !session?.user.id) return;
    Promise.all([
      db.groups().select('*').eq('id', id).single(),
      db.groupMembers().select('*').eq('group_id', id).eq('user_id', session.user.id).maybeSingle(),
      db.posts().select('*, profiles(display_name)').eq('group_id', id).order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data: g }, { data: mem }, { data: p }]) => {
      setGroup(g);
      setIsMember(!!mem);
      setPosts(p ?? []);
      setLoading(false);
    });
  }, [id]);

  const toggleMembership = async () => {
    if (!session?.user.id || !id) return;
    if (isMember) {
      await db.groupMembers().delete().eq('group_id', id).eq('user_id', session.user.id);
      setIsMember(false);
    } else {
      await db.groupMembers().insert({ group_id: id, user_id: session.user.id });
      setIsMember(true);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1A6B3C" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group?.name ?? 'Group'}</Text>
        <TouchableOpacity style={[styles.joinBtn, isMember && styles.leaveBtn]} onPress={toggleMembership}>
          <Text style={[styles.joinText, isMember && styles.leaveText]}>{isMember ? 'Leave' : 'Join'}</Text>
        </TouchableOpacity>
      </View>

      {group?.description ? (
        <View style={styles.descCard}>
          <Text style={styles.desc}>{group.description}</Text>
          <Text style={styles.memberCount}>{group.member_count} members</Text>
        </View>
      ) : null}

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          isMember ? (
            <TouchableOpacity style={styles.newPostBtn} onPress={() => router.push('/community/post/new')}>
              <Ionicons name="add-circle-outline" size={18} color="#1A6B3C" />
              <Text style={styles.newPostText}>Create a post</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.postCard} onPress={() => router.push(`/community/post/${item.id}`)}>
            <Text style={styles.postAuthor}>{item.profiles?.display_name ?? 'User'}</Text>
            {item.title ? <Text style={styles.postTitle}>{item.title}</Text> : null}
            <Text style={styles.postBody} numberOfLines={3}>{item.content}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No posts in this group yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  joinBtn: { backgroundColor: '#1A6B3C', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  leaveBtn: { backgroundColor: '#F0F0F0' },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  leaveText: { color: '#666' },
  descCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 14 },
  desc: { fontSize: 14, color: '#444', lineHeight: 20 },
  memberCount: { fontSize: 12, color: '#999', marginTop: 6 },
  newPostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  newPostText: { color: '#1A6B3C', fontWeight: '600' },
  postCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  postAuthor: { fontSize: 12, fontWeight: '700', color: '#1A6B3C', marginBottom: 4 },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  postBody: { fontSize: 14, color: '#444', lineHeight: 20 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
