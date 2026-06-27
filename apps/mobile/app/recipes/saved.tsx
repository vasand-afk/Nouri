import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function SavedRecipesScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) return;
    db.savedRecipes()
      .select('recipe_id, recipes(*)')
      .eq('user_id', session.user.id)
      .order('saved_at', { ascending: false })
      .then(({ data }) => {
        setRecipes((data ?? []).map((d: any) => d.recipes).filter(Boolean));
        setIsLoading(false);
      });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Recipes</Text>
        <View style={{ width: 26 }} />
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#1A6B3C" />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/recipes/${item.id}`)}
            >
              <Text style={styles.name}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No saved recipes yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  name: { fontSize: 15, color: '#1A1A1A', flex: 1 },
  empty: { textAlign: 'center', color: '#999', marginTop: 60 },
});
