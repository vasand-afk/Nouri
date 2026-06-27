import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function MyRecipesScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) return;
    db.recipes()
      .select('*')
      .eq('author_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRecipes(data ?? []); setIsLoading(false); });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>My Recipes</Text>
        <TouchableOpacity onPress={() => router.push('/recipes/create')}>
          <Ionicons name="add" size={26} color="#1A6B3C" />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#1A6B3C" />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/recipes/${item.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.title}</Text>
                <Text style={styles.meta}>{item.is_public ? 'Public' : 'Private'} · {item.saves_count} saves</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Text style={styles.empty}>No recipes yet.</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/recipes/create')}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Create your first recipe</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  name: { fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  empty: { color: '#999' },
  createBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
});
