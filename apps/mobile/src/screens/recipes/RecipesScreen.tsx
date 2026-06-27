import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { db } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Recipe } from '../../types';

const TAGS = [
  { key: 'all', label: 'All' },
  { key: 'high_protein', label: '💪 High Protein' },
  { key: 'glp1_friendly', label: '💉 GLP-1 Friendly' },
  { key: 'quick', label: '⚡ Under 20 min' },
  { key: 'keto', label: '🥑 Keto' },
  { key: 'vegan', label: '🌱 Vegan' },
  { key: 'meal_prep', label: '📦 Meal Prep' },
];

export default function RecipesScreen() {
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { fetchRecipes(); }, [activeTag, query]);

  const fetchRecipes = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    let q = db.recipes()
      .select(`*, author:profiles!author_id(username, display_name, avatar_url)`)
      .eq('is_public', true)
      .order('saves_count', { ascending: false })
      .limit(40);

    if (activeTag !== 'all') q = q.contains('tags', [activeTag]);
    if (query.length > 1) q = q.ilike('title', `%${query}%`);

    const { data } = await q;
    setRecipes((data ?? []) as Recipe[]);

    // Fetch saved recipe IDs for the current user
    if (session?.user.id) {
      const { data: saved } = await db.savedRecipes()
        .select('recipe_id')
        .eq('user_id', session.user.id);
      setSavedIds(new Set((saved ?? []).map((s: any) => s.recipe_id)));
    }

    setIsLoading(false);
    setIsRefreshing(false);
  };

  const toggleSave = async (recipe: Recipe) => {
    if (!session?.user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isSaved = savedIds.has(recipe.id);

    // Optimistic
    setSavedIds(prev => {
      const next = new Set(prev);
      isSaved ? next.delete(recipe.id) : next.add(recipe.id);
      return next;
    });

    if (isSaved) {
      await db.savedRecipes()
        .delete()
        .eq('user_id', session.user.id)
        .eq('recipe_id', recipe.id);
    } else {
      await db.savedRecipes()
        .insert({ user_id: session.user.id, recipe_id: recipe.id });
    }
  };

  const renderRecipe = useCallback(({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      isSaved={savedIds.has(item.id)}
      onPress={() => router.push(`/recipes/${item.id}`)}
      onSave={() => toggleSave(item)}
    />
  ), [savedIds]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/recipes/create')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color="#AAA" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color="#CCC" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tag filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagScroll}
        contentContainerStyle={styles.tagRow}
      >
        {TAGS.map(tag => (
          <TouchableOpacity
            key={tag.key}
            style={[styles.tag, activeTag === tag.key && styles.tagActive]}
            onPress={() => setActiveTag(tag.key)}
          >
            <Text style={[styles.tagText, activeTag === tag.key && styles.tagTextActive]}>
              {tag.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs: Community / Saved */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>Discover</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push('/recipes/saved')}
        >
          <Text style={styles.tabText}>Saved ({savedIds.size})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push('/recipes/mine')}
        >
          <Text style={styles.tabText}>My Recipes</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#1A6B3C" size="large" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderRecipe}
          keyExtractor={r => r.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchRecipes(true)}
              tintColor="#1A6B3C"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyText}>No recipes found</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/recipes/create')}
              >
                <Text style={styles.emptyBtnText}>Be the first to add one</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Recipe Card ────────────────────────────────────────────

function RecipeCard({
  recipe, isSaved, onPress, onSave,
}: {
  recipe: Recipe; isSaved: boolean; onPress: () => void; onSave: () => void;
}) {
  const author = (recipe as any).author;
  const totalTime = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Cover image */}
      <View style={styles.cardImageWrapper}>
        {recipe.cover_image_url ? (
          <Image source={{ uri: recipe.cover_image_url }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Text style={styles.cardImageEmoji}>🍽️</Text>
          </View>
        )}
        {/* Save button */}
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isSaved ? '#1A6B3C' : '#fff'}
          />
        </TouchableOpacity>
        {/* Difficulty badge */}
        {recipe.difficulty && (
          <View style={[styles.diffBadge, diffColors[recipe.difficulty]]}>
            <Text style={styles.diffText}>{recipe.difficulty}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {recipe.tags.slice(0, 3).map(tag => (
              <View key={tag} style={styles.cardTag}>
                <Text style={styles.cardTagText}>{tag.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Nutrition row */}
        <View style={styles.cardNutrition}>
          {recipe.calories_per_serving && (
            <NutriChip label="kcal" value={recipe.calories_per_serving.toFixed(0)} />
          )}
          {recipe.protein_per_serving && (
            <NutriChip label="pro" value={`${recipe.protein_per_serving.toFixed(0)}g`} color="#4CAF50" />
          )}
          {totalTime > 0 && (
            <NutriChip label="min" value={totalTime.toString()} color="#FF9800" />
          )}
        </View>

        {/* Author + rating */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {author?.display_name ?? author?.username ?? 'Anonymous'}
          </Text>
          {recipe.ratings_count > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={11} color="#FF9800" />
              <Text style={styles.ratingText}>{recipe.ratings_avg.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function NutriChip({ label, value, color = '#555' }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.nutriChip}>
      <Text style={[styles.nutriValue, { color }]}>{value}</Text>
      <Text style={styles.nutriLabel}>{label}</Text>
    </View>
  );
}

const diffColors: Record<string, any> = {
  easy: { backgroundColor: '#D1FAE5' },
  medium: { backgroundColor: '#FEF3C7' },
  hard: { backgroundColor: '#FEE2E2' },
};

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
  tagScroll: { maxHeight: 44 },
  tagRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tag: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F0F0F0',
  },
  tagActive: { backgroundColor: '#1A6B3C' },
  tagText: { fontSize: 13, color: '#555', fontWeight: '600' },
  tagTextActive: { color: '#fff' },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    marginTop: 10, backgroundColor: '#fff',
  },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1A6B3C' },
  tabText: { fontSize: 13, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#1A6B3C' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 100 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18,
    overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardImageWrapper: { position: 'relative' },
  cardImage: { width: '100%', aspectRatio: 1.1 },
  cardImageFallback: { backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  cardImageEmoji: { fontSize: 36 },
  saveBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  diffBadge: {
    position: 'absolute', bottom: 8, left: 8,
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  diffText: { fontSize: 10, fontWeight: '700', color: '#333', textTransform: 'capitalize' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', lineHeight: 19 },
  cardTag: {
    backgroundColor: '#F0FBF5', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginRight: 4,
  },
  cardTagText: { fontSize: 10, color: '#1A6B3C', fontWeight: '600', textTransform: 'capitalize' },
  cardNutrition: { flexDirection: 'row', gap: 6, marginTop: 6 },
  nutriChip: { alignItems: 'center' },
  nutriValue: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  nutriLabel: { fontSize: 9, color: '#AAA', textTransform: 'uppercase' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
  },
  cardAuthor: { fontSize: 11, color: '#AAA', flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, color: '#555', fontWeight: '600' },
  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#999' },
  emptyBtn: { backgroundColor: '#1A6B3C', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
