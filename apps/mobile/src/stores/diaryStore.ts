import { create } from 'zustand';
import { format } from 'date-fns';
import { db } from '../services/supabase';
import { DiaryEntry, DailySummary, MealType } from '../types';
import { calculateNutrition } from '../services/foodDatabase';

interface DiaryState {
  selectedDate: string;
  entries: DiaryEntry[];
  summary: DailySummary | null;
  waterMl: number;
  isLoading: boolean;

  setDate: (date: string) => void;
  fetchDay: (date: string, userId: string) => Promise<void>;
  logFood: (entry: Omit<DiaryEntry, 'id' | 'user_id' | 'created_at'>, userId: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  logWater: (ml: number, userId: string) => Promise<void>;
  getEntriesByMeal: () => Record<MealType, DiaryEntry[]>;
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  entries: [],
  summary: null,
  waterMl: 0,
  isLoading: false,

  setDate: (date) => set({ selectedDate: date }),

  fetchDay: async (date, userId) => {
    set({ isLoading: true });

    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;

    const [entriesRes, summaryRes, waterRes] = await Promise.all([
      db.diary()
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lte('logged_at', end)
        .order('logged_at'),
      db.summaries()
        .select('*')
        .eq('user_id', userId)
        .eq('summary_date', date)
        .single(),
      db.water()
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lte('logged_at', end),
    ]);

    const waterMl = (waterRes.data ?? []).reduce((sum: number, w: any) => sum + w.amount_ml, 0);

    set({
      entries: (entriesRes.data ?? []) as DiaryEntry[],
      summary: summaryRes.data as DailySummary | null,
      waterMl,
      isLoading: false,
    });
  },

  logFood: async (entry, userId) => {
    const { data } = await db.diary()
      .insert({ ...entry, user_id: userId })
      .select()
      .single();

    if (data) {
      set((state) => ({ entries: [...state.entries, data as DiaryEntry] }));
    }
  },

  deleteEntry: async (id) => {
    await db.diary().delete().eq('id', id);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  logWater: async (ml, userId) => {
    await db.water().insert({ user_id: userId, amount_ml: ml });
    set((state) => ({ waterMl: state.waterMl + ml }));
  },

  getEntriesByMeal: () => {
    const meals: Record<MealType, DiaryEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      pre_workout: [],
      post_workout: [],
    };
    for (const entry of get().entries) {
      meals[entry.meal_type].push(entry);
    }
    return meals;
  },
}));
