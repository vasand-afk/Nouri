import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { db } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'glp1', label: '💉 GLP-1' },
  { key: 'weight_loss', label: '⬇️ Weight Loss' },
  { key: 'muscle_gain', label: '💪 Muscle Gain' },
  { key: 'keto', label: '🥑 Keto' },
  { key: 'vegan', label: '🌱 Vegan' },
  { key: 'meal_prep', label: '📦 Meal Prep' },
];

export default function GroupsScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'joined'>('discover');

  useEffect(() => { fetchGroups(); }, [category, activeTab]);

  const fetchGroups = async () => {
    setIsLoading(true);

    let q = db.groups()
      .select('*')
      .order('members_count', { ascending: false })
      .limit(40);

    if (category !== 'all') q = q.eq('category', category);
    if (activeTab === 'joined' && session?.user.id) {
      const { data: memberships } = await db.groupMembers()
        .select('group_id')
        .eq('user_id', session.user.id);
      const ids = (memberships ?? []).map((m: any) => m.group_id);
      if (ids.length === 0) { setGroups([]); setIsLoading(false); return; }
      q = q.in('id', ids);
    }

    const { data } = await q;
    setGroups((data ?? []) as any[]);

    if (session?.user.id) {
      const { data: memberships } = await db.groupMembers()
        .select('group_id')
        .eq('user_id', session.user.id);
      setJoinedIds(new Set((memberships ?? []).map((m: any) => m.group_id)));
    }

    setIsLoading(false);
  };

  const toggleJoin = async (group: any) => {
    if (!session?.user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isJoined = joinedIds.has(group.id);

    setJoinedIds(prev => {
      const next = new Set(prev);
      isJoined ? next.delete(group.id) : next.add(group.id);
      return next;
    });

    if (isJoined) {
      await db.groupMembers()
        .delete()
        .eq('group_id', group.id)
        .eq('user_id', session.user.id);
      await db.groups()
        .update({ members_count: Math.max(0, group.members_count - 1) })
        .eq('id', group.id);
    } else {
      await db.groupMembers().insert({ group_id: group.id, user_id: session.user.id });
      await db.groups()
        .update({ members_count: group.members_count + 1 })
        .eq('id', group.id);
    }
  };

  const filtered = query.length > 1
    ? groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
    : groups;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/community/groups/create')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color="#AAA" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['discover', 'joined'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'discover' ? 'Discover' : `Joined (${joinedIds.size})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catRow}
      >
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[styles.catChip, category === c.key && styles.catChipActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#1A6B3C" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={g => g.id}
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              isJoined={joinedIds.has(item.id)}
              onJoin={() => toggleJoin(item)}
              onPress={() => router.push(`/community/groups/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'joined' ? "You haven't joined any groups yet" : 'No groups found'}
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/community/groups/create')}>
                <Text style={styles.emptyBtnText}>Create a Group</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function GroupCard({ group, isJoined, onJoin, onPress }: {
  group: any; isJoined: boolean; onJoin: () => void; onPress: () => void;
}) {
  const typeIcon: Record<string, string> = {
    public: 'earth',
    private: 'lock-closed',
    invite_only: 'mail',
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.cardLeft}>
        {group.cover_image_url ? (
          <Image source={{ uri: group.cover_image_url }} style={styles.groupAvatar} />
        ) : (
          <View style={[styles.groupAvatar, styles.groupAvatarFallback]}>
            <Text style={styles.groupAvatarEmoji}>
              {group.category === 'glp1' ? '💉' : group.category === 'keto' ? '🥑' : '👥'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          <Ionicons name={(typeIcon[group.group_type] ?? 'earth') as any} size={13} color="#AAA" />
        </View>
        {group.description && (
          <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text>
        )}
        <View style={styles.cardMeta}>
          <Ionicons name="people" size={13} color="#AAA" />
          <Text style={styles.membersText}>{group.members_count} members</Text>
          {group.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{group.category.replace(/_/g, ' ')}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.joinBtn, isJoined && styles.joinBtnJoined]}
        onPress={onJoin}
      >
        <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextJoined]}>
          {isJoined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1A6B3C', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1A6B3C' },
  tabText: { fontSize: 13, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#1A6B3C' },
  catScroll: { maxHeight: 44, marginTop: 8 },
  catRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F0F0F0',
  },
  catChipActive: { backgroundColor: '#1A6B3C' },
  catChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardLeft: {},
  groupAvatar: { width: 54, height: 54, borderRadius: 16 },
  groupAvatarFallback: {
    backgroundColor: '#F0FBF5', alignItems: 'center', justifyContent: 'center',
  },
  groupAvatarEmoji: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  groupName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  groupDesc: { fontSize: 12, color: '#888', lineHeight: 17, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersText: { fontSize: 12, color: '#AAA', marginRight: 6 },
  categoryBadge: {
    backgroundColor: '#F0FBF5', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  categoryText: { fontSize: 10, color: '#1A6B3C', fontWeight: '700', textTransform: 'capitalize' },
  joinBtn: {
    borderWidth: 1.5, borderColor: '#1A6B3C', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  joinBtnJoined: { backgroundColor: '#1A6B3C', borderColor: '#1A6B3C' },
  joinBtnText: { fontSize: 13, color: '#1A6B3C', fontWeight: '700' },
  joinBtnTextJoined: { color: '#fff' },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 16, color: '#999', textAlign: 'center' },
  emptyBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
