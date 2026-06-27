import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { format, formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../stores/authStore';
import { db, supabase } from '../../services/supabase';
import { Post } from '../../types';

type FeedTab = 'following' | 'discover' | 'glp1' | 'groups';

export default function FeedScreen() {
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<FeedTab>('discover');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPosts();
    const sub = subscribeToNewPosts();
    return () => { sub.unsubscribe(); };
  }, [activeTab]);

  const fetchPosts = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    let query = db.posts()
      .select(`
        *,
        author:profiles!author_id (
          username, display_name, avatar_url, is_glp1_user
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(30);

    if (activeTab === 'glp1') {
      query = query.eq('post_type', 'glp1_update');
    } else if (activeTab === 'following' && session?.user.id) {
      // Fetch IDs this user follows
      const { data: followData } = await db.follows()
        .select('following_id')
        .eq('follower_id', session.user.id);

      const followingIds = (followData ?? []).map((f: any) => f.following_id);
      if (followingIds.length > 0) {
        query = query.in('author_id', followingIds);
      }
    }

    const { data } = await query;

    // Check which posts the current user has liked
    if (data && session?.user.id) {
      const postIds = data.map((p: any) => p.id);
      const { data: likes } = await db.postLikes()
        .select('post_id')
        .eq('user_id', session.user.id)
        .in('post_id', postIds);

      const likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
      setPosts(data.map((p: any) => ({ ...p, is_liked: likedSet.has(p.id) })) as Post[]);
    } else {
      setPosts((data ?? []) as Post[]);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  };

  const subscribeToNewPosts = () => {
    return supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        fetchPosts();
      })
      .subscribe();
  };

  const toggleLike = async (post: Post) => {
    if (!session?.user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) }
          : p
      )
    );

    if (post.is_liked) {
      await db.postLikes().delete()
        .eq('post_id', post.id)
        .eq('user_id', session.user.id);
    } else {
      await db.postLikes().insert({ post_id: post.id, user_id: session.user.id });
    }
  };

  const renderPost = useCallback(({ item: post }: { item: Post }) => (
    <PostCard post={post} onLike={() => toggleLike(post)} onPress={() => router.push(`/community/post/${post.id}`)} />
  ), [session?.user.id]);

  const tabs: { key: FeedTab; label: string; icon: any }[] = [
    { key: 'discover', label: 'Discover', icon: 'compass' },
    { key: 'following', label: 'Following', icon: 'people' },
    { key: 'glp1', label: 'GLP-1', icon: 'medical' },
    { key: 'groups', label: 'Groups', icon: 'grid' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>nouri</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/community/search')}>
            <Ionicons name="search" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/community/post/new')}>
            <Ionicons name="add-circle" size={28} color="#1A6B3C" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? '#1A6B3C' : '#999'}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#1A6B3C" size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchPosts(true)}
              tintColor="#1A6B3C"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'following'
                  ? 'Follow people to see their posts here.'
                  : 'No posts yet. Be the first to share!'}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/community/post/new')}
              >
                <Text style={styles.emptyBtnText}>Create a Post</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Post Card ─────────────────────────────────────────────

function PostCard({
  post, onLike, onPress,
}: {
  post: Post; onLike: () => void; onPress: () => void;
}) {
  const author = (post as any).author;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <TouchableOpacity style={styles.postCard} onPress={onPress} activeOpacity={0.97}>
      {/* Author */}
      <View style={styles.postHeader}>
        <View style={styles.authorRow}>
          {author?.avatar_url ? (
            <Image source={{ uri: author.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(author?.display_name ?? author?.username ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.authorName}>{author?.display_name ?? author?.username}</Text>
              {author?.is_glp1_user && (
                <View style={styles.glp1Badge}>
                  <Text style={styles.glp1BadgeText}>GLP-1</Text>
                </View>
              )}
            </View>
            <Text style={styles.postTime}>{timeAgo}</Text>
          </View>
        </View>
        <PostTypeBadge type={post.post_type} />
      </View>

      {/* Content */}
      {post.content && (
        <Text style={styles.postContent} numberOfLines={5}>
          {post.content}
        </Text>
      )}

      {/* Media */}
      {post.media_urls.length > 0 && (
        <View style={styles.mediaGrid}>
          {post.media_urls.slice(0, 4).map((url, i) => (
            <Image key={i} source={{ uri: url }} style={[
              styles.mediaImage,
              post.media_urls.length === 1 && styles.mediaSingle,
            ]} />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Ionicons
            name={post.is_liked ? 'heart' : 'heart-outline'}
            size={22}
            color={post.is_liked ? '#EF4444' : '#777'}
          />
          <Text style={styles.actionCount}>{post.likes_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={20} color="#777" />
          <Text style={styles.actionCount}>{post.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="share-outline" size={20} color="#777" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={20} color="#777" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function PostTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    progress: { label: 'Progress', color: '#059669', bg: '#D1FAE5' },
    meal: { label: 'Meal', color: '#D97706', bg: '#FEF3C7' },
    recipe_share: { label: 'Recipe', color: '#7C3AED', bg: '#EDE9FE' },
    glp1_update: { label: 'GLP-1', color: '#DC2626', bg: '#FEE2E2' },
    challenge_update: { label: 'Challenge', color: '#2563EB', bg: '#DBEAFE' },
  };

  const c = config[type];
  if (!c) return null;

  return (
    <View style={[styles.typeBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.typeBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  logo: { fontSize: 24, fontWeight: '900', color: '#1A6B3C', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1A6B3C' },
  tabText: { fontSize: 12, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#1A6B3C' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  postCard: {
    backgroundColor: '#fff',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#1A6B3C' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  glp1Badge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  glp1BadgeText: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  postTime: { fontSize: 12, color: '#999', marginTop: 1 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  postContent: { fontSize: 15, color: '#1A1A1A', lineHeight: 22, marginBottom: 10 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  mediaImage: { width: '48%', aspectRatio: 1, borderRadius: 8 },
  mediaSingle: { width: '100%', aspectRatio: 16 / 9 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12 },
  actionCount: { fontSize: 13, color: '#777', fontWeight: '500' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#999', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
