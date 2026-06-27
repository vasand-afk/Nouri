import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';

export default function CommunitySearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setPosts([]); setGroups([]); return; }
    setLoading(true);
    const [{ data: p }, { data: g }] = await Promise.all([
      db.posts().select('id, title, content, post_type, profiles(display_name)').ilike('content', `%${q}%`).limit(15),
      db.groups().select('id, name, description, member_count').ilike('name', `%${q}%`).limit(10),
    ]);
    setPosts(p ?? []);
    setGroups(g ?? []);
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts and groups…"
            autoFocus
            value={query}
            onChangeText={search}
            returnKeyType="search"
          />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1A6B3C" />
      ) : (
        <FlatList
          data={[
            ...groups.map(g => ({ ...g, _type: 'group' })),
            ...posts.map(p => ({ ...p, _type: 'post' })),
          ]}
          keyExtractor={item => `${item._type}-${item.id}`}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) =>
            item._type === 'group' ? (
              <TouchableOpacity style={styles.row} onPress={() => router.push(`/community/groups/${item.id}`)}>
                <Ionicons name="people" size={18} color="#1A6B3C" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowMeta}>{item.member_count} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CCC" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.row} onPress={() => router.push(`/community/post/${item.id}`)}>
                <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title ?? item.content?.slice(0, 60)}</Text>
                  <Text style={styles.rowMeta}>{item.profiles?.display_name ?? 'User'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CCC" />
              </TouchableOpacity>
            )
          }
          ListEmptyComponent={query.length >= 2 ? <Text style={styles.empty}>No results for "{query}"</Text> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  rowMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
