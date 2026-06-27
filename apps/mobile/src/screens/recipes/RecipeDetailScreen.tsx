import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Alert, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { db } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useDiaryStore } from '../../stores/diaryStore';
import { Recipe } from '@nouri/shared/types';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuthStore();
  const { logFood } = useDiaryStore();

  const [recipe, setRecipe] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [servings, setServings] = useState(1);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingMeal, setIsLoggingMeal] = useState(false);

  useEffect(() => { fetchRecipe(); }, [id]);

  const fetchRecipe = async () => {
    const [recipeRes, ingredientsRes, stepsRes, savedRes, ratingRes] = await Promise.all([
      db.recipes()
        .select(`*, author:profiles!author_id(id, username, display_name, avatar_url, followers_count)`)
        .eq('id', id)
        .single(),
      db.recipeIngredients()
        .select('*')
        .eq('recipe_id', id)
        .order('sort_order'),
      db.recipeSteps()
        .select('*')
        .eq('recipe_id', id)
        .order('step_number'),
      session?.user.id
        ? db.savedRecipes()
            .select('recipe_id')
            .eq('user_id', session.user.id)
            .eq('recipe_id', id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      session?.user.id
        ? db.recipeRatings()
            .select('rating')
            .eq('recipe_id', id)
            .eq('user_id', session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setRecipe(recipeRes.data);
    setIngredients(ingredientsRes.data ?? []);
    setSteps(stepsRes.data ?? []);
    setIsSaved(!!savedRes.data);
    setUserRating(ratingRes.data?.rating ?? 0);
    setServings(recipeRes.data?.servings ?? 1);
    setIsLoading(false);
  };

  const toggleSave = async () => {
    if (!session?.user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaved(prev => !prev);

    if (isSaved) {
      await db.savedRecipes()
        .delete()
        .eq('user_id', session.user.id)
        .eq('recipe_id', id);
    } else {
      await db.savedRecipes()
        .insert({ user_id: session.user.id, recipe_id: id });
      // Increment save count
      await db.recipes()
        .update({ saves_count: (recipe?.saves_count ?? 0) + 1 })
        .eq('id', id);
    }
  };

  const submitRating = async (rating: number) => {
    if (!session?.user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserRating(rating);

    await db.recipeRatings()
      .upsert({ recipe_id: id, user_id: session.user.id, rating });

    // Recalculate avg on the server side via a trigger (or do it here)
    const { data: ratings } = await db.recipeRatings()
      .select('rating')
      .eq('recipe_id', id);

    if (ratings) {
      const avg = ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length;
      await db.recipes().update({
        ratings_avg: Math.round(avg * 100) / 100,
        ratings_count: ratings.length,
      }).eq('id', id);
    }
  };

  const logRecipeAsMeal = async () => {
    if (!session?.user.id || !recipe) return;
    setIsLoggingMeal(true);

    await logFood(
      {
        logged_at: new Date().toISOString(),
        meal_type: 'lunch',
        food_name: recipe.title,
        amount_g: servings * 100,
        calories: (recipe.calories_per_serving ?? 0) * servings,
        protein_g: (recipe.protein_per_serving ?? 0) * servings,
        carbs_g: (recipe.carbs_per_serving ?? 0) * servings,
        fat_g: (recipe.fat_per_serving ?? 0) * servings,
        fiber_g: 0,
        log_method: 'recipe',
        photo_url: recipe.cover_image_url ?? null,
        notes: null,
        ai_confidence: null,
      },
      session.user.id
    );

    setIsLoggingMeal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Logged!', `${recipe.title} added to your food diary.`);
  };

  const shareRecipe = async () => {
    await Share.share({
      title: recipe?.title,
      message: `Check out this recipe on Nouri: ${recipe?.title}\n${recipe?.description ?? ''}`,
    });
  };

  if (isLoading || !recipe) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#1A6B3C" size="large" />
      </View>
    );
  }

  const totalTime = (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0);
  const author = recipe.author;
  const scaleFactor = servings / (recipe.servings ?? 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover image */}
        <View style={styles.coverWrapper}>
          {recipe.cover_image_url ? (
            <Image source={{ uri: recipe.cover_image_url }} style={styles.cover} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.cover}>
              <Text style={styles.coverEmoji}>🍽️</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.coverActions}>
            <TouchableOpacity style={styles.coverActionBtn} onPress={shareRecipe}>
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.coverActionBtn} onPress={toggleSave}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isSaved ? '#4CAF50' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Title + meta */}
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          {recipe.description && (
            <Text style={styles.recipeDesc}>{recipe.description}</Text>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            {recipe.prep_time_min && <StatBox icon="time-outline" label="Prep" value={`${recipe.prep_time_min}m`} />}
            {recipe.cook_time_min && <StatBox icon="flame-outline" label="Cook" value={`${recipe.cook_time_min}m`} />}
            {totalTime > 0 && <StatBox icon="alarm-outline" label="Total" value={`${totalTime}m`} />}
            <StatBox icon="people-outline" label="Serves" value={recipe.servings?.toString() ?? '1'} />
            {recipe.difficulty && (
              <StatBox icon="speedometer-outline" label="Level" value={recipe.difficulty} />
            )}
          </View>

          {/* Tags */}
          {recipe.tags?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {recipe.tags.map((t: string) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Nutrition per serving — with serving adjuster */}
          <View style={styles.nutritionCard}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.sectionTitle}>Nutrition</Text>
              <View style={styles.servingControl}>
                <TouchableOpacity
                  onPress={() => setServings(Math.max(1, servings - 1))}
                  style={styles.servingBtn}
                >
                  <Ionicons name="remove" size={16} color="#1A6B3C" />
                </TouchableOpacity>
                <Text style={styles.servingCount}>{servings} serving{servings > 1 ? 's' : ''}</Text>
                <TouchableOpacity
                  onPress={() => setServings(servings + 1)}
                  style={styles.servingBtn}
                >
                  <Ionicons name="add" size={16} color="#1A6B3C" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.macroRow}>
              <MacroBox
                label="Calories"
                value={((recipe.calories_per_serving ?? 0) * scaleFactor).toFixed(0)}
                unit="kcal"
                color="#FF9800"
              />
              <MacroBox
                label="Protein"
                value={((recipe.protein_per_serving ?? 0) * scaleFactor).toFixed(1)}
                unit="g"
                color="#4CAF50"
              />
              <MacroBox
                label="Carbs"
                value={((recipe.carbs_per_serving ?? 0) * scaleFactor).toFixed(1)}
                unit="g"
                color="#2196F3"
              />
              <MacroBox
                label="Fat"
                value={((recipe.fat_per_serving ?? 0) * scaleFactor).toFixed(1)}
                unit="g"
                color="#9C27B0"
              />
            </View>
          </View>

          {/* Log meal CTA */}
          <TouchableOpacity
            style={styles.logMealBtn}
            onPress={logRecipeAsMeal}
            disabled={isLoggingMeal}
          >
            {isLoggingMeal ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.logMealBtnText}>
                  Log {servings} serving{servings > 1 ? 's' : ''} to diary
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Ingredients */}
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.ingredientList}>
            {ingredients.map((ing, i) => {
              const scaledG = ing.amount_g ? (ing.amount_g * scaleFactor).toFixed(0) : null;
              return (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <Text style={styles.ingredientName}>{ing.ingredient_name}</Text>
                  <Text style={styles.ingredientAmount}>
                    {ing.display_amount
                      ? servings === recipe.servings
                        ? ing.display_amount
                        : `${scaledG}g`
                      : scaledG ? `${scaledG}g` : ''}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Steps */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Instructions</Text>
          {steps.map((step, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.stepCard, checkedSteps.has(i) && styles.stepCardDone]}
              onPress={() => {
                const next = new Set(checkedSteps);
                checkedSteps.has(i) ? next.delete(i) : next.add(i);
                setCheckedSteps(next);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.stepNum, checkedSteps.has(i) && styles.stepNumDone]}>
                {checkedSteps.has(i) ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.stepNumText}>{step.step_number}</Text>
                )}
              </View>
              <Text style={[styles.stepText, checkedSteps.has(i) && styles.stepTextDone]}>
                {step.instruction}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Author */}
          <TouchableOpacity
            style={styles.authorCard}
            onPress={() => router.push(`/profile/${author?.id}`)}
          >
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitial}>
                {(author?.display_name ?? author?.username ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorLabel}>Recipe by</Text>
              <Text style={styles.authorName}>
                {author?.display_name ?? author?.username ?? 'Anonymous'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CCC" />
          </TouchableOpacity>

          {/* Rating */}
          <View style={styles.ratingCard}>
            <Text style={styles.sectionTitle}>Rate this recipe</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => submitRating(s)}>
                  <Ionicons
                    name={s <= userRating ? 'star' : 'star-outline'}
                    size={32}
                    color="#FF9800"
                  />
                </TouchableOpacity>
              ))}
            </View>
            {recipe.ratings_count > 0 && (
              <Text style={styles.ratingSummary}>
                {recipe.ratings_avg.toFixed(1)} avg from {recipe.ratings_count} rating{recipe.ratings_count !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={16} color="#1A6B3C" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MacroBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.macroBox}>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={styles.macroUnit}>{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrapper: { position: 'relative' },
  cover: { width: '100%', height: 280, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 60 },
  backBtn: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  coverActions: {
    position: 'absolute', top: 16, right: 16,
    flexDirection: 'row', gap: 8,
  },
  coverActionBtn: {
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 20 },
  recipeTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  recipeDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  statBox: { alignItems: 'center', gap: 3 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', textTransform: 'capitalize' },
  statLabel: { fontSize: 10, color: '#AAA' },
  tag: {
    backgroundColor: '#F0FBF5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginRight: 6,
  },
  tagText: { fontSize: 12, color: '#1A6B3C', fontWeight: '600', textTransform: 'capitalize' },
  nutritionCard: {
    backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  nutritionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  servingControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  servingBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center',
  },
  servingCount: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroBox: { alignItems: 'center', gap: 2 },
  macroValue: { fontSize: 18, fontWeight: '800' },
  macroUnit: { fontSize: 11, color: '#888' },
  macroLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
  logMealBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A6B3C', borderRadius: 14, paddingVertical: 14, gap: 8, marginBottom: 24,
  },
  logMealBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ingredientList: { gap: 10, marginBottom: 24 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A6B3C' },
  ingredientName: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  ingredientAmount: { fontSize: 13, color: '#888', fontWeight: '600' },
  stepCard: {
    flexDirection: 'row', gap: 12, padding: 14,
    backgroundColor: '#F8F8F8', borderRadius: 14, marginBottom: 10,
  },
  stepCardDone: { backgroundColor: '#F0FBF5', opacity: 0.8 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A6B3C', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumDone: { backgroundColor: '#4CAF50' },
  stepNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20, paddingTop: 4 },
  stepTextDone: { textDecorationLine: 'line-through', color: '#AAA' },
  authorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8F8', borderRadius: 14, padding: 14, marginTop: 12, marginBottom: 20,
  },
  authorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E8F8EE', alignItems: 'center', justifyContent: 'center',
  },
  authorInitial: { fontSize: 18, fontWeight: '700', color: '#1A6B3C' },
  authorLabel: { fontSize: 11, color: '#999' },
  authorName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  ratingCard: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  stars: { flexDirection: 'row', gap: 8 },
  ratingSummary: { fontSize: 13, color: '#888' },
});
