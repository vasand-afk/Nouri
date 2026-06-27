import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { db, supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';

const AVAILABLE_TAGS = [
  'high_protein', 'glp1_friendly', 'keto', 'vegan', 'vegetarian',
  'meal_prep', 'quick', 'dairy_free', 'gluten_free', 'low_carb',
];

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface Step {
  instruction: string;
}

export default function CreateRecipeScreen() {
  const router = useRouter();
  const { session, profile } = useAuthStore();

  // Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('2');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  // Nutrition per serving
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Ingredients & steps
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', amount: '', unit: 'g' },
  ]);
  const [steps, setSteps] = useState<Step[]>([{ instruction: '' }]);

  const [isSaving, setIsSaving] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setCoverImageUri(result.assets[0].uri);
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    const ext = uri.split('.').pop() ?? 'jpg';
    const fileName = `recipes/${session!.user.id}_${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { data, error } = await supabase.storage
      .from('recipe-images')
      .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

    if (error || !data) return null;

    const { data: { publicUrl } } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const addIngredient = () =>
    setIngredients([...ingredients, { name: '', amount: '', unit: 'g' }]);

  const updateIngredient = (i: number, field: keyof Ingredient, value: string) => {
    const next = [...ingredients];
    next[i] = { ...next[i], [field]: value };
    setIngredients(next);
  };

  const removeIngredient = (i: number) =>
    setIngredients(ingredients.filter((_, idx) => idx !== i));

  const addStep = () =>
    setSteps([...steps, { instruction: '' }]);

  const updateStep = (i: number, value: string) => {
    const next = [...steps];
    next[i].instruction = value;
    setSteps(next);
  };

  const removeStep = (i: number) =>
    setSteps(steps.filter((_, idx) => idx !== i));

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const save = async () => {
    if (!title.trim()) { Alert.alert('Missing', 'Recipe title is required.'); return; }
    if (ingredients.filter(i => i.name.trim()).length === 0) {
      Alert.alert('Missing', 'Add at least one ingredient.');
      return;
    }
    if (steps.filter(s => s.instruction.trim()).length === 0) {
      Alert.alert('Missing', 'Add at least one step.');
      return;
    }
    if (!session?.user.id) return;

    setIsSaving(true);

    try {
      // Upload cover image
      let imageUrl: string | null = null;
      if (coverImageUri) {
        imageUrl = await uploadImage(coverImageUri);
      }

      // Create recipe
      const { data: recipe, error } = await db.recipes()
        .insert({
          author_id: session.user.id,
          title: title.trim(),
          description: description.trim() || null,
          cover_image_url: imageUrl,
          prep_time_min: parseInt(prepTime) || null,
          cook_time_min: parseInt(cookTime) || null,
          servings: parseInt(servings) || 1,
          difficulty: difficulty || null,
          calories_per_serving: parseFloat(calories) || null,
          protein_per_serving: parseFloat(protein) || null,
          carbs_per_serving: parseFloat(carbs) || null,
          fat_per_serving: parseFloat(fat) || null,
          tags,
          is_public: isPublic,
        })
        .select()
        .single();

      if (error || !recipe) throw error;

      // Insert ingredients
      const validIngredients = ingredients.filter(i => i.name.trim());
      if (validIngredients.length > 0) {
        await db.recipeIngredients().insert(
          validIngredients.map((ing, idx) => ({
            recipe_id: recipe.id,
            ingredient_name: ing.name.trim(),
            amount_g: parseFloat(ing.amount) || null,
            display_amount: ing.amount ? `${ing.amount}${ing.unit}` : null,
            sort_order: idx,
          }))
        );
      }

      // Insert steps
      const validSteps = steps.filter(s => s.instruction.trim());
      if (validSteps.length > 0) {
        await db.recipeSteps().insert(
          validSteps.map((step, idx) => ({
            recipe_id: recipe.id,
            step_number: idx + 1,
            instruction: step.instruction.trim(),
          }))
        );
      }

      router.replace(`/recipes/${recipe.id}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Recipe</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={save}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Publish</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cover image */}
          <TouchableOpacity style={styles.coverPicker} onPress={pickImage}>
            {coverImageUri ? (
              <Image source={{ uri: coverImageUri }} style={styles.coverPreview} contentFit="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={36} color="#CCC" />
                <Text style={styles.coverPlaceholderText}>Add cover photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <Section title="Title *">
            <TextInput
              style={styles.input}
              placeholder="e.g. High-Protein Chicken Bowl"
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </Section>

          {/* Description */}
          <Section title="Description">
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="A quick description of this recipe..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </Section>

          {/* Time + servings */}
          <View style={styles.row}>
            <Section title="Prep (min)" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" placeholder="10" />
            </Section>
            <Section title="Cook (min)" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" placeholder="20" />
            </Section>
            <Section title="Servings" style={{ flex: 1 }}>
              <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="2" />
            </Section>
          </View>

          {/* Difficulty */}
          <Section title="Difficulty">
            <View style={styles.chipRow}>
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, difficulty === d && styles.chipActive]}
                  onPress={() => setDifficulty(d)}
                >
                  <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Nutrition per serving */}
          <Section title="Nutrition per serving">
            <View style={styles.row}>
              {[
                { label: 'Calories', state: calories, set: setCalories },
                { label: 'Protein (g)', state: protein, set: setProtein },
                { label: 'Carbs (g)', state: carbs, set: setCarbs },
                { label: 'Fat (g)', state: fat, set: setFat },
              ].map(({ label, state, set }) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={styles.subLabel}>{label}</Text>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    value={state}
                    onChangeText={set}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </View>
              ))}
            </View>
          </Section>

          {/* Tags */}
          <Section title="Tags">
            <View style={styles.chipWrap}>
              {AVAILABLE_TAGS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, tags.includes(tag) && styles.chipActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.chipText, tags.includes(tag) && styles.chipTextActive]}>
                    {tag.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Ingredients */}
          <Section title="Ingredients *">
            {ingredients.map((ing, i) => (
              <View key={i} style={styles.ingRow}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  placeholder="Ingredient"
                  value={ing.name}
                  onChangeText={v => updateIngredient(i, 'name', v)}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Amount"
                  value={ing.amount}
                  onChangeText={v => updateIngredient(i, 'amount', v)}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.input, styles.unitInput]}
                  placeholder="g"
                  value={ing.unit}
                  onChangeText={v => updateIngredient(i, 'unit', v)}
                />
                {ingredients.length > 1 && (
                  <TouchableOpacity onPress={() => removeIngredient(i)}>
                    <Ionicons name="close-circle" size={20} color="#FF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
              <Ionicons name="add" size={18} color="#1A6B3C" />
              <Text style={styles.addRowText}>Add ingredient</Text>
            </TouchableOpacity>
          </Section>

          {/* Steps */}
          <Section title="Instructions *">
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textarea, { flex: 1 }]}
                  placeholder={`Step ${i + 1}...`}
                  value={step.instruction}
                  onChangeText={v => updateStep(i, v)}
                  multiline
                />
                {steps.length > 1 && (
                  <TouchableOpacity onPress={() => removeStep(i)}>
                    <Ionicons name="close-circle" size={20} color="#FF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
              <Ionicons name="add" size={18} color="#1A6B3C" />
              <Text style={styles.addRowText}>Add step</Text>
            </TouchableOpacity>
          </Section>

          {/* Visibility */}
          <View style={styles.visibilityRow}>
            <View>
              <Text style={styles.visibilityLabel}>Share with community</Text>
              <Text style={styles.visibilityHint}>Others can discover and save your recipe</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ true: '#1A6B3C', false: '#DDD' }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  saveBtn: {
    backgroundColor: '#1A6B3C', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  saveBtnDisabled: { backgroundColor: '#A5D6B7' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: 16, paddingBottom: 60 },
  coverPicker: {
    height: 180, borderRadius: 16, overflow: 'hidden',
    marginBottom: 20, backgroundColor: '#F5F5F5',
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#DDD',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverPlaceholderText: { fontSize: 14, color: '#CCC' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  subLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: '#EBEBEB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1A1A1A', backgroundColor: '#FAFAFA',
  },
  smallInput: { paddingVertical: 8 },
  textarea: { height: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA',
  },
  chipActive: { borderColor: '#1A6B3C', backgroundColor: '#F0FBF5' },
  chipText: { fontSize: 12, color: '#555', fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#1A6B3C' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  unitInput: { width: 44, textAlign: 'center' },
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10,
  },
  addRowText: { fontSize: 14, color: '#1A6B3C', fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNumBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A6B3C', alignItems: 'center', justifyContent: 'center', marginTop: 10,
    flexShrink: 0,
  },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  visibilityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F8F8F8', borderRadius: 14, padding: 16, marginTop: 8,
  },
  visibilityLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  visibilityHint: { fontSize: 12, color: '#999', marginTop: 2 },
});
