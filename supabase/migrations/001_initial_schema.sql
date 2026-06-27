-- ============================================================
-- NOURI — Initial Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- fuzzy food search

-- ============================================================
-- AUTH & PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,

  -- Health data
  date_of_birth DATE,
  sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  goal TEXT CHECK (goal IN ('lose_weight', 'maintain', 'gain_muscle', 'improve_health', 'manage_condition')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),

  -- Dietary preferences
  dietary_preferences TEXT[] DEFAULT '{}', -- vegan, keto, gluten_free, etc.
  allergies TEXT[] DEFAULT '{}',

  -- GLP-1 / peptide tracking
  is_glp1_user BOOLEAN DEFAULT FALSE,
  glp1_medication TEXT, -- semaglutide, tirzepatide, etc.
  glp1_dose_mg NUMERIC(4,2),
  glp1_start_date DATE,

  -- Computed nutrition targets (recalculated on profile update)
  daily_calories_target INTEGER,
  protein_target_g INTEGER,
  carbs_target_g INTEGER,
  fat_target_g INTEGER,

  -- Community
  is_coach BOOLEAN DEFAULT FALSE,
  coach_credentials TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,

  -- Notifications
  notification_prefs JSONB DEFAULT '{"meal_reminders": true, "injection_reminders": true, "community_activity": true}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FOOD DATABASE
-- ============================================================
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usda_fdc_id TEXT UNIQUE,
  open_food_facts_id TEXT UNIQUE,
  barcode TEXT,

  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,

  -- Per 100g
  calories_per_100g NUMERIC(7,2),
  protein_per_100g NUMERIC(6,2),
  carbs_per_100g NUMERIC(6,2),
  fat_per_100g NUMERIC(6,2),
  fiber_per_100g NUMERIC(6,2),
  sugar_per_100g NUMERIC(6,2),
  sodium_per_100mg NUMERIC(6,2),

  -- Extended micros (JSON for flexibility)
  micronutrients JSONB DEFAULT '{}',

  -- Serving info
  serving_size_g NUMERIC(6,1),
  serving_description TEXT, -- "1 cup", "1 slice"

  -- Quality
  nutri_score TEXT CHECK (nutri_score IN ('A','B','C','D','E')),
  nova_group INTEGER CHECK (nova_group BETWEEN 1 AND 4),

  verified BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_foods_name_trgm ON foods USING gin(name gin_trgm_ops);
CREATE INDEX idx_foods_barcode ON foods(barcode);
CREATE INDEX idx_foods_usda ON foods(usda_fdc_id);

-- ============================================================
-- FOOD DIARY
-- ============================================================
CREATE TABLE diary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout')),

  food_id UUID REFERENCES foods(id),
  food_name TEXT NOT NULL, -- denormalized for deleted foods

  amount_g NUMERIC(7,1) NOT NULL,

  -- Calculated at log time (snapshot of nutrition)
  calories NUMERIC(7,1),
  protein_g NUMERIC(6,1),
  carbs_g NUMERIC(6,1),
  fat_g NUMERIC(6,1),
  fiber_g NUMERIC(6,1),

  -- How was it logged
  log_method TEXT CHECK (log_method IN ('barcode', 'photo_ai', 'voice', 'search', 'recipe', 'manual')),
  ai_confidence NUMERIC(3,2), -- 0–1 for photo/voice logs

  notes TEXT,
  photo_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diary_user_date ON diary_entries(user_id, logged_at DESC);

-- Daily nutrition summary (materialized or computed)
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,

  total_calories NUMERIC(7,1) DEFAULT 0,
  total_protein_g NUMERIC(6,1) DEFAULT 0,
  total_carbs_g NUMERIC(6,1) DEFAULT 0,
  total_fat_g NUMERIC(6,1) DEFAULT 0,
  total_fiber_g NUMERIC(6,1) DEFAULT 0,
  water_ml INTEGER DEFAULT 0,

  meals_logged INTEGER DEFAULT 0,
  goal_met BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
);

-- ============================================================
-- WATER TRACKING
-- ============================================================
CREATE TABLE water_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  amount_ml INTEGER NOT NULL
);

CREATE INDEX idx_water_user_date ON water_logs(user_id, logged_at DESC);

-- ============================================================
-- BODY MEASUREMENTS
-- ============================================================
CREATE TABLE body_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,

  weight_kg NUMERIC(5,1),
  body_fat_pct NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,1),

  -- Tape measurements (cm)
  waist_cm NUMERIC(5,1),
  hips_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  arm_cm NUMERIC(5,1),
  thigh_cm NUMERIC(5,1),

  -- Source
  source TEXT CHECK (source IN ('manual', 'dexa', 'inbody', 'smart_scale', 'apple_health', 'google_fit')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, measured_at)
);

-- ============================================================
-- GLP-1 / PEPTIDE TRACKER
-- ============================================================
CREATE TABLE injection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  injected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  medication TEXT NOT NULL, -- semaglutide, tirzepatide, BPC-157, TB-500, etc.
  medication_type TEXT CHECK (medication_type IN ('glp1', 'peptide', 'other')),
  dose_mg NUMERIC(5,3),
  dose_unit TEXT DEFAULT 'mg', -- mg, mcg, IU
  injection_site TEXT, -- abdomen, thigh, arm

  next_dose_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT FALSE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE side_effect_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ DEFAULT NOW(),

  -- Severity 1–10
  nausea INTEGER CHECK (nausea BETWEEN 0 AND 10),
  fatigue INTEGER CHECK (fatigue BETWEEN 0 AND 10),
  appetite_level INTEGER CHECK (appetite_level BETWEEN 0 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 0 AND 10),
  mood INTEGER CHECK (mood BETWEEN 0 AND 10),

  gi_symptoms TEXT[], -- bloating, constipation, diarrhea
  notes TEXT,
  injection_log_id UUID REFERENCES injection_logs(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RECIPES
-- ============================================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,

  prep_time_min INTEGER,
  cook_time_min INTEGER,
  servings INTEGER DEFAULT 1,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Nutrition per serving (computed)
  calories_per_serving NUMERIC(7,1),
  protein_per_serving NUMERIC(6,1),
  carbs_per_serving NUMERIC(6,1),
  fat_per_serving NUMERIC(6,1),

  -- Dietary tags
  tags TEXT[] DEFAULT '{}', -- keto, vegan, high_protein, glp1_friendly
  cuisine TEXT,

  -- Community
  is_public BOOLEAN DEFAULT TRUE,
  saves_count INTEGER DEFAULT 0,
  ratings_avg NUMERIC(3,2) DEFAULT 0,
  ratings_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id UUID REFERENCES foods(id),
  ingredient_name TEXT NOT NULL,
  amount_g NUMERIC(7,1),
  display_amount TEXT, -- "1 cup", "2 tbsp"
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE recipe_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  image_url TEXT
);

CREATE TABLE recipe_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id, user_id)
);

CREATE TABLE saved_recipes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

-- ============================================================
-- MEAL PLANS
-- ============================================================
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL, -- 1–7
  meal_type TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  food_id UUID REFERENCES foods(id),
  food_name TEXT,
  amount_g NUMERIC(7,1),
  sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- COMMUNITY — POSTS & SOCIAL
-- ============================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  content TEXT,
  media_urls TEXT[] DEFAULT '{}',

  post_type TEXT CHECK (post_type IN ('general', 'progress', 'meal', 'recipe_share', 'glp1_update', 'challenge_update')),

  -- Linked entities
  diary_entry_id UUID REFERENCES diary_entries(id),
  recipe_id UUID REFERENCES recipes(id),

  -- Community features
  group_id UUID, -- FK added after groups table
  challenge_id UUID, -- FK added after challenges table

  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,

  is_public BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_feed ON posts(created_at DESC, is_public) WHERE is_public = TRUE;
CREATE INDEX idx_posts_author ON posts(author_id, created_at DESC);

CREATE TABLE post_likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES post_comments(id),
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNITY — GROUPS
-- ============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  group_type TEXT CHECK (group_type IN ('public', 'private', 'invite_only')),
  category TEXT, -- glp1, keto, vegan, weight_loss, muscle_gain

  owner_id UUID NOT NULL REFERENCES profiles(id),
  members_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Add FK for posts.group_id
ALTER TABLE posts ADD CONSTRAINT fk_posts_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- ============================================================
-- COMMUNITY — CHALLENGES
-- ============================================================
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id),

  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,

  challenge_type TEXT CHECK (challenge_type IN ('protein_goal', 'calorie_goal', 'logging_streak', 'water_intake', 'weight_loss', 'custom')),
  target_value NUMERIC(10,2),
  target_unit TEXT,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  participants_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE challenge_participants (
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  current_value NUMERIC(10,2) DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);

ALTER TABLE posts ADD CONSTRAINT fk_posts_challenge FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE SET NULL;

-- ============================================================
-- COACH MARKETPLACE
-- ============================================================
CREATE TABLE coach_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  specialties TEXT[] DEFAULT '{}', -- weight_loss, glp1_support, sports_nutrition, eating_disorders
  credentials TEXT, -- RD, RDN, CNS, etc.
  bio TEXT,
  years_experience INTEGER,

  hourly_rate_usd NUMERIC(7,2),
  session_types TEXT[] DEFAULT '{}', -- video, chat, async_review

  is_verified BOOLEAN DEFAULT FALSE, -- credential verification
  is_accepting_clients BOOLEAN DEFAULT TRUE,

  ratings_avg NUMERIC(3,2) DEFAULT 0,
  ratings_count INTEGER DEFAULT 0,
  clients_count INTEGER DEFAULT 0,

  stripe_account_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coach_client_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES profiles(id),
  client_id UUID NOT NULL REFERENCES profiles(id),

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  access_level TEXT DEFAULT 'diary' CHECK (access_level IN ('diary', 'full', 'custom')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  UNIQUE(coach_id, client_id)
);

-- ============================================================
-- AI COACH CONVERSATIONS
-- ============================================================
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Tool calls / structured data
  tool_calls JSONB,

  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type TEXT NOT NULL, -- like, comment, follow, injection_reminder, challenge_update, coach_message
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',

  read BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- ============================================================
-- WEARABLE / HEALTH SYNC
-- ============================================================
CREATE TABLE health_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- apple_health, google_fit, fitbit, garmin, whoop, dexcom, libre

  synced_at TIMESTAMPTZ DEFAULT NOW(),
  data_type TEXT NOT NULL, -- steps, calories_burned, heart_rate, glucose, sleep
  value NUMERIC(10,3),
  unit TEXT,
  recorded_at TIMESTAMPTZ
);

CREATE INDEX idx_health_sync_user ON health_sync_logs(user_id, source, data_type, recorded_at DESC);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL, -- active, canceled, past_due, trialing
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE injection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE side_effect_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_own_write" ON profiles FOR ALL USING (auth.uid() = id);

-- Diary: own only (coaches via coach_client_relationships)
CREATE POLICY "diary_own" ON diary_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "summaries_own" ON daily_summaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "measurements_own" ON body_measurements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "injections_own" ON injection_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "side_effects_own" ON side_effect_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "water_own" ON water_logs FOR ALL USING (auth.uid() = user_id);

-- Posts: public read, own write
CREATE POLICY "posts_public_read" ON posts FOR SELECT USING (is_public = TRUE OR auth.uid() = author_id);
CREATE POLICY "posts_own_write" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_own_update" ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_own_delete" ON posts FOR DELETE USING (auth.uid() = author_id);

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);

-- AI: own only
CREATE POLICY "ai_convos_own" ON ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ai_messages_own" ON ai_messages FOR ALL USING (
  conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update followers/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Update daily summary when diary entry changes
CREATE OR REPLACE FUNCTION upsert_daily_summary()
RETURNS TRIGGER AS $$
DECLARE
  entry_date DATE;
BEGIN
  entry_date := (COALESCE(NEW.logged_at, OLD.logged_at))::DATE;

  INSERT INTO daily_summaries (user_id, summary_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, meals_logged)
  SELECT
    COALESCE(NEW.user_id, OLD.user_id),
    entry_date,
    COALESCE(SUM(calories), 0),
    COALESCE(SUM(protein_g), 0),
    COALESCE(SUM(carbs_g), 0),
    COALESCE(SUM(fat_g), 0),
    COALESCE(SUM(fiber_g), 0),
    COUNT(*)
  FROM diary_entries
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND logged_at::DATE = entry_date
  ON CONFLICT (user_id, summary_date) DO UPDATE SET
    total_calories = EXCLUDED.total_calories,
    total_protein_g = EXCLUDED.total_protein_g,
    total_carbs_g = EXCLUDED.total_carbs_g,
    total_fat_g = EXCLUDED.total_fat_g,
    total_fiber_g = EXCLUDED.total_fiber_g,
    meals_logged = EXCLUDED.meals_logged,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_diary_entry_change
  AFTER INSERT OR UPDATE OR DELETE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION upsert_daily_summary();
