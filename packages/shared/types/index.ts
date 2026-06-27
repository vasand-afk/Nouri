// ============================================================
// NOURI — Shared Types
// ============================================================

export type Goal = 'lose_weight' | 'maintain' | 'gain_muscle' | 'improve_health' | 'manage_condition';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
export type LogMethod = 'barcode' | 'photo_ai' | 'voice' | 'search' | 'recipe' | 'manual';
export type PostType = 'general' | 'progress' | 'meal' | 'recipe_share' | 'glp1_update' | 'challenge_update';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_premium: boolean;

  date_of_birth: string | null;
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: Goal | null;
  activity_level: ActivityLevel | null;

  dietary_preferences: string[];
  allergies: string[];

  is_glp1_user: boolean;
  glp1_medication: string | null;
  glp1_dose_mg: number | null;
  glp1_start_date: string | null;

  daily_calories_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;

  is_coach: boolean;
  followers_count: number;
  following_count: number;

  created_at: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;

  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number | null;

  serving_size_g: number | null;
  serving_description: string | null;
  nutri_score: 'A' | 'B' | 'C' | 'D' | 'E' | null;
}

export interface NutritionSummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface DiaryEntry extends NutritionSummary {
  id: string;
  user_id: string;
  logged_at: string;
  meal_type: MealType;
  food_name: string;
  amount_g: number;
  log_method: LogMethod | null;
  ai_confidence: number | null;
  photo_url: string | null;
  notes: string | null;
}

export interface DailySummary {
  summary_date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  water_ml: number;
  meals_logged: number;
}

export interface BodyMeasurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
  source: string;
}

export interface InjectionLog {
  id: string;
  injected_at: string;
  medication: string;
  medication_type: 'glp1' | 'peptide' | 'other';
  dose_mg: number | null;
  injection_site: string | null;
  next_dose_at: string | null;
  notes: string | null;
}

export interface SideEffectLog {
  id: string;
  logged_at: string;
  nausea: number;
  fatigue: number;
  appetite_level: number;
  energy_level: number;
  mood: number;
  notes: string | null;
}

export interface Recipe {
  id: string;
  author_id: string;
  author?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  calories_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  tags: string[];
  saves_count: number;
  ratings_avg: number;
  ratings_count: number;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  author?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>;
  content: string | null;
  media_urls: string[];
  post_type: PostType;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  created_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  target_value: number;
  target_unit: string;
  start_date: string;
  end_date: string;
  participants_count: number;
  user_progress?: number;
}

export interface CoachProfile {
  id: string;
  user_id: string;
  profile: Profile;
  specialties: string[];
  credentials: string | null;
  bio: string | null;
  hourly_rate_usd: number | null;
  is_verified: boolean;
  ratings_avg: number;
  clients_count: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Nutrition targets calculator
export function calculateTargets(profile: Partial<Profile>): NutritionSummary & { water_ml: number } {
  const weight = profile.weight_kg ?? 70;
  const height = profile.height_cm ?? 170;
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 30;
  const isMale = profile.sex === 'male';

  // Mifflin-St Jeor BMR
  const bmr = isMale
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const activityMultiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  const tdee = bmr * (activityMultiplier[profile.activity_level ?? 'moderate']);

  let calories = tdee;
  if (profile.goal === 'lose_weight') calories = tdee - 500;
  if (profile.goal === 'gain_muscle') calories = tdee + 300;

  // GLP-1 users often need higher protein ratios
  const proteinMultiplier = profile.is_glp1_user ? 1.8 : 1.6;
  const protein_g = Math.round(weight * proteinMultiplier);
  const fat_g = Math.round((calories * 0.28) / 9);
  const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);

  return {
    calories: Math.round(calories),
    protein_g,
    carbs_g,
    fat_g,
    fiber_g: 30,
    water_ml: Math.round(weight * 35), // 35ml per kg body weight
  };
}
