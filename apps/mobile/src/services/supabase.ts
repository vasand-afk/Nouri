import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Typed query helpers
export const db = {
  profiles: () => supabase.from('profiles'),
  foods: () => supabase.from('foods'),
  diary: () => supabase.from('diary_entries'),
  summaries: () => supabase.from('daily_summaries'),
  water: () => supabase.from('water_logs'),
  measurements: () => supabase.from('body_measurements'),
  injections: () => supabase.from('injection_logs'),
  sideEffects: () => supabase.from('side_effect_logs'),
  recipes: () => supabase.from('recipes'),
  recipeIngredients: () => supabase.from('recipe_ingredients'),
  recipeSteps: () => supabase.from('recipe_steps'),
  recipeRatings: () => supabase.from('recipe_ratings'),
  savedRecipes: () => supabase.from('saved_recipes'),
  mealPlans: () => supabase.from('meal_plans'),
  posts: () => supabase.from('posts'),
  postLikes: () => supabase.from('post_likes'),
  postComments: () => supabase.from('post_comments'),
  groups: () => supabase.from('groups'),
  groupMembers: () => supabase.from('group_members'),
  challenges: () => supabase.from('challenges'),
  challengeParticipants: () => supabase.from('challenge_participants'),
  coaches: () => supabase.from('coach_profiles'),
  follows: () => supabase.from('follows'),
  notifications: () => supabase.from('notifications'),
  aiConversations: () => supabase.from('ai_conversations'),
  aiMessages: () => supabase.from('ai_messages'),
  subscriptions: () => supabase.from('subscriptions'),
  healthSync: () => supabase.from('health_sync_logs'),
};
