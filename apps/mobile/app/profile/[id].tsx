import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = session?.user.id === id;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      db.profiles().select('*').eq('id', id).single(),
      db.posts().select('id, title, content, post_type, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
      session?.user.id && !isOwnProfile
        ? db.follows().select('*').eq('follower_id', session.user.id).eq('following_id', id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([{ data: p }, { data: ps }, { data: f }]) => {
      setProfile(p);
      setPosts(ps ?? []);
      setIsFollowing(!!f);
      setLoading(false);
    });
  }, [id]);

  const toggleFollow = async () => {
    if (!session?.user.id || !id || isOwnProfile) return;
    if (isFollowing) {
      await db.follows().delete().eq('follower_id', session.user.id).eq('following_id', id);
      setIsFollowing(false);
    } else {
      await db.follows().insert({ follower_id: session.user.id, following_id: id });
      setIsFollowing(true);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#1A6B3C" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.display_name ?? 'Profile'}</Text>
        {!isOwnProfile && (
          <TouchableOpacity style={[styles.followBtn, isFollowing && styles.followingBtn]} onPress={toggleFollow}>
            <Text style={[styles.followText, isFollowing && styles.followingText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.profileCard}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color="#CCC" />
            </View>
          )}
          <Text style={styles.name}>{profile?.display_name ?? 'Nouri User'}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <View style={styles.statsRow}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statNum}>{profile?.follower_count ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statNum}>{profile?.following_count ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statNum}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Posts</Text>
        {posts.map(post => (
          <TouchableOpacity key={post.id} style={styles.postCard} onPress={() => router.push(`/community/post/${post.id}`)}>
            {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}
            <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>
            <Text style={styles.postDate}>{new Date(post.created_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        ))}
        {posts.length === 0 && <Text style={styles.empty}>No posts yet.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  followBtn: { backgroundColor: '#1A6B3C', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  followingBtn: { backgroundColor: '#F0F0F0' },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingText: { color: '#666' },
  profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  bio: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 40, marginTop: 8 },
  statNum: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  statLabel: { fontSize: 11, color: '#999' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  postCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 4 },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  postContent: { fontSize: 14, color: '#444', lineHeight: 20 },
  postDate: { fontSize: 11, color: '#999' },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
});
