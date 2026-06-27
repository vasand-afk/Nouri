import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../stores/authStore';
import { useDiaryStore } from '../../stores/diaryStore';
import { searchFoods, lookupBarcode, calculateNutrition } from '../../services/foodDatabase';
import { recognizeFoodFromPhoto, parseFoodFromVoice } from '../../services/ai';
import { Food, MealType } from '@nouri/shared/types';
import FoodResultCard from '../../components/diary/FoodResultCard';

type LogMode = 'menu' | 'barcode' | 'camera_ai' | 'voice' | 'search';

export default function LogMealScreen() {
  const router = useRouter();
  const { meal } = useLocalSearchParams<{ meal?: MealType }>();
  const { session } = useAuthStore();
  const { logFood } = useDiaryStore();

  const [mode, setMode] = useState<LogMode>('menu');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState('100');
  const [selectedMeal, setSelectedMeal] = useState<MealType>(meal ?? 'lunch');
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);

  const device = useCameraDevice('back');
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // ─── Barcode scanner ─────────────────────────────────────
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-8', 'ean-13', 'upc-a', 'upc-e', 'qr'],
    onCodeScanned: async (codes) => {
      const barcode = codes[0]?.value;
      if (!barcode || isLoading) return;

      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const food = await lookupBarcode(barcode);
        if (food) {
          setSelectedFood(food);
          setMode('menu');
        } else {
          Alert.alert('Not found', 'This barcode is not in our database. Try searching manually.');
          setMode('search');
        }
      } finally {
        setIsLoading(false);
      }
    },
  });

  // ─── Photo AI recognition ─────────────────────────────────
  const handlePhotoCapture = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]?.base64) return;

    setIsLoading(true);
    setMode('menu');

    try {
      const data = await recognizeFoodFromPhoto(
        result.assets[0].base64,
        session!.access_token
      );
      setAiResults(data.foods);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not identify food from photo. Please try again or search manually.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Voice input ──────────────────────────────────────────
  const handleVoiceInput = async () => {
    // In production: use expo-av or react-native-voice to record + transcribe
    // For now, show a text prompt as fallback
    Alert.prompt(
      'What did you eat?',
      'Describe your meal (e.g. "2 scrambled eggs and a slice of whole wheat toast")',
      async (text) => {
        if (!text) return;
        setIsLoading(true);
        setMode('menu');
        try {
          const foods = await parseFoodFromVoice(text, session!.access_token);
          setAiResults(foods);
        } catch {
          Alert.alert('Error', 'Could not parse your meal. Please try searching.');
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  // ─── Search ───────────────────────────────────────────────
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    clearTimeout(searchTimeout.current);
    if (text.length < 2) { setSearchResults([]); return; }

    searchTimeout.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchFoods(text);
        setSearchResults(results);
      } finally {
        setIsLoading(false);
      }
    }, 400);
  }, []);

  // ─── Log selected food ────────────────────────────────────
  const handleLogFood = async (food: Food, amountG: number, logMethod: string) => {
    if (!session?.user.id) return;

    const nutrition = calculateNutrition(food, amountG);

    await logFood(
      {
        logged_at: new Date().toISOString(),
        meal_type: selectedMeal,
        food_id: food.id,
        food_name: food.name,
        amount_g: amountG,
        log_method: logMethod as any,
        ...nutrition,
        photo_url: null,
        notes: null,
        ai_confidence: null,
      },
      session.user.id
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  // ─── Render modes ─────────────────────────────────────────

  if (mode === 'barcode' && device) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          codeScanner={codeScanner}
        />
        <SafeAreaView style={styles.cameraOverlay}>
          <TouchableOpacity onPress={() => setMode('menu')} style={styles.backBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Point camera at a barcode</Text>
          {isLoading && <ActivityIndicator color="#fff" size="large" />}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-down" size={28} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Food</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Meal type selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealPicker}>
          {(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'] as MealType[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.mealChip, selectedMeal === m && styles.mealChipActive]}
              onPress={() => setSelectedMeal(m)}
            >
              <Text style={[styles.mealChipText, selectedMeal === m && styles.mealChipTextActive]}>
                {m.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }}>
          {/* Log method buttons */}
          {mode === 'menu' && !selectedFood && aiResults.length === 0 && (
            <View style={styles.methodGrid}>
              <MethodButton
                icon="camera"
                label="Photo AI"
                sublabel="Snap & identify"
                color="#7C3AED"
                onPress={handlePhotoCapture}
              />
              <MethodButton
                icon="barcode"
                label="Scan Barcode"
                sublabel="Any packaged food"
                color="#DC2626"
                onPress={() => setMode('barcode')}
              />
              <MethodButton
                icon="mic"
                label="Voice"
                sublabel="Say what you ate"
                color="#059669"
                onPress={handleVoiceInput}
              />
              <MethodButton
                icon="search"
                label="Search"
                sublabel="300k+ foods"
                color="#2563EB"
                onPress={() => setMode('search')}
              />
            </View>
          )}

          {/* Loading */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#1A6B3C" size="large" />
              <Text style={styles.loadingText}>Analyzing your food...</Text>
            </View>
          )}

          {/* AI Results (photo / voice) */}
          {aiResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.sectionTitle}>Identified Foods</Text>
              {aiResults.map((item, i) => (
                <FoodResultCard
                  key={i}
                  food={item}
                  onLog={(amountG) => handleLogFood(item, amountG, 'photo_ai')}
                />
              ))}
            </View>
          )}

          {/* Search */}
          {(mode === 'search' || searchQuery.length > 0) && (
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search foods, brands, recipes..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus={mode === 'search'}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>

              {searchResults.map((food) => (
                <FoodResultCard
                  key={food.id}
                  food={food}
                  onLog={(amountG) => handleLogFood(food, amountG, 'search')}
                />
              ))}
            </View>
          )}

          {/* Selected food from barcode */}
          {selectedFood && (
            <View style={styles.resultsContainer}>
              <Text style={styles.sectionTitle}>Scanned Product</Text>
              <FoodResultCard
                food={selectedFood}
                onLog={(amountG) => handleLogFood(selectedFood, amountG, 'barcode')}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MethodButton({
  icon, label, sublabel, color, onPress,
}: {
  icon: any; label: string; sublabel: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.methodBtn} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.methodIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.methodLabel}>{label}</Text>
      <Text style={styles.methodSublabel}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  mealPicker: { paddingHorizontal: 16, paddingVertical: 12 },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  mealChipActive: { backgroundColor: '#1A6B3C' },
  mealChipText: { fontSize: 13, color: '#555', fontWeight: '500', textTransform: 'capitalize' },
  mealChipTextActive: { color: '#fff' },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  methodBtn: {
    width: '47%',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  methodIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  methodLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  methodSublabel: { fontSize: 11, color: '#999', marginTop: 2 },
  loadingContainer: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 15, color: '#555' },
  resultsContainer: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  searchContainer: { padding: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  scanFrame: {
    width: 260,
    height: 200,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 60 },
});
