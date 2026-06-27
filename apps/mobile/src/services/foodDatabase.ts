import { Food } from '../types';
import { db } from './supabase';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OPEN_FOOD_FACTS_BASE = 'https://world.openfoodfacts.org/api/v2';
const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';

// ============================================================
// Barcode Lookup
// ============================================================
export async function lookupBarcode(barcode: string): Promise<Food | null> {
  // 1. Check local DB first
  const { data: local } = await db.foods()
    .select('*')
    .eq('barcode', barcode)
    .single();

  if (local) return local as Food;

  // 2. Open Food Facts
  try {
    const res = await fetch(`${OPEN_FOOD_FACTS_BASE}/product/${barcode}.json`);
    const json = await res.json();

    if (json.status === 1 && json.product) {
      const p = json.product;
      const n = p.nutriments ?? {};

      const food: Omit<Food, 'id'> = {
        name: p.product_name ?? 'Unknown Product',
        brand: p.brands ?? null,
        barcode,
        calories_per_100g: n['energy-kcal_100g'] ?? n['energy_100g'] / 4.184 ?? 0,
        protein_per_100g: n.proteins_100g ?? 0,
        carbs_per_100g: n.carbohydrates_100g ?? 0,
        fat_per_100g: n.fat_100g ?? 0,
        fiber_per_100g: n.fiber_100g ?? null,
        serving_size_g: p.serving_quantity ?? null,
        serving_description: p.serving_size ?? null,
        nutri_score: p.nutriscore_grade?.toUpperCase() ?? null,
      };

      // Cache in Supabase
      const { data: inserted } = await db.foods().insert(food).select().single();
      return inserted as Food;
    }
  } catch {}

  return null;
}

// ============================================================
// Text Search (Supabase fuzzy + USDA fallback)
// ============================================================
export async function searchFoods(query: string, limit = 25): Promise<Food[]> {
  // Supabase trigram search
  const { data: local } = await db.foods()
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (local && local.length >= 5) return local as Food[];

  // USDA FoodData Central
  try {
    const res = await fetch(
      `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&api_key=${USDA_API_KEY}`
    );
    const json = await res.json();

    const foods: Food[] = (json.foods ?? []).map((f: any) => {
      const nutrients: Record<string, number> = {};
      for (const n of f.foodNutrients ?? []) {
        nutrients[n.nutrientNumber] = n.value;
      }

      return {
        id: f.fdcId?.toString(),
        name: f.description,
        brand: f.brandOwner ?? null,
        barcode: f.gtinUpc ?? null,
        calories_per_100g: nutrients['208'] ?? 0, // Energy kcal
        protein_per_100g: nutrients['203'] ?? 0,
        carbs_per_100g: nutrients['205'] ?? 0,
        fat_per_100g: nutrients['204'] ?? 0,
        fiber_per_100g: nutrients['291'] ?? null,
        serving_size_g: f.servingSize ?? null,
        serving_description: f.servingSizeUnit ?? null,
        nutri_score: null,
      };
    });

    // Cache in background
    if (foods.length > 0) {
      db.foods().upsert(foods.filter(f => f.name)).then(() => {});
    }

    const combined = [...(local ?? []), ...foods];
    const seen = new Set<string>();
    return combined.filter(f => {
      const key = f.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) as Food[];
  } catch {
    return (local ?? []) as Food[];
  }
}

// ============================================================
// Nutrition calculation
// ============================================================
export function calculateNutrition(food: Food, amountG: number) {
  const factor = amountG / 100;
  return {
    calories: Math.round(food.calories_per_100g * factor * 10) / 10,
    protein_g: Math.round(food.protein_per_100g * factor * 10) / 10,
    carbs_g: Math.round(food.carbs_per_100g * factor * 10) / 10,
    fat_g: Math.round(food.fat_per_100g * factor * 10) / 10,
    fiber_g: Math.round((food.fiber_per_100g ?? 0) * factor * 10) / 10,
  };
}
