import Anthropic from '@anthropic-ai/sdk';
import { DiaryEntry, DailySummary, Profile, NutritionSummary } from '../types';

// Claude client runs via Supabase Edge Function to protect API key
const EDGE_FUNCTION_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

// ============================================================
// Photo Food Recognition
// ============================================================
export async function recognizeFoodFromPhoto(
  base64Image: string,
  sessionToken: string
): Promise<{
  foods: Array<{ name: string; estimated_g: number; confidence: number } & NutritionSummary>;
  meal_description: string;
}> {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      action: 'recognize_food',
      image_base64: base64Image,
    }),
  });

  if (!res.ok) throw new Error('Photo recognition failed');
  return res.json();
}

// ============================================================
// Voice Transcription → Food Items
// ============================================================
export async function parseFoodFromVoice(
  transcript: string,
  sessionToken: string
): Promise<Array<{ name: string; amount: string; estimated_g: number } & NutritionSummary>> {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      action: 'parse_voice',
      transcript,
    }),
  });

  if (!res.ok) throw new Error('Voice parsing failed');
  return res.json();
}

// ============================================================
// Diary Analysis (Weekly Feedback)
// ============================================================
export async function analyzeDiary(
  entries: DiaryEntry[],
  summaries: DailySummary[],
  profile: Profile,
  sessionToken: string
): Promise<{
  score: number;
  highlights: string[];
  improvements: string[];
  protein_trend: string;
  week_summary: string;
}> {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      action: 'analyze_diary',
      entries: entries.slice(0, 50), // last 50 entries
      summaries,
      profile,
    }),
  });

  if (!res.ok) throw new Error('Diary analysis failed');
  return res.json();
}

// ============================================================
// Meal Plan Generation
// ============================================================
export async function generateMealPlan(
  profile: Profile,
  preferences: {
    days: number;
    avoid_ingredients?: string[];
    pantry_items?: string[];
    max_prep_time_min?: number;
    budget?: 'low' | 'medium' | 'high';
  },
  sessionToken: string
) {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      action: 'generate_meal_plan',
      profile,
      preferences,
    }),
  });

  if (!res.ok) throw new Error('Meal plan generation failed');
  return res.json();
}

// ============================================================
// Pantry → Recipe Suggestions
// ============================================================
export async function suggestFromPantry(
  pantryItems: string[],
  profile: Profile,
  sessionToken: string
): Promise<Array<{
  title: string;
  description: string;
  prep_time_min: number;
  nutrition_per_serving: NutritionSummary;
  steps: string[];
  tags: string[];
}>> {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      action: 'pantry_suggestions',
      pantry_items: pantryItems,
      profile,
    }),
  });

  if (!res.ok) throw new Error('Pantry suggestions failed');
  return res.json();
}

// ============================================================
// Chat Message (streaming)
// ============================================================
export async function* streamChatMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  profile: Profile,
  todaysSummary: DailySummary | null,
  sessionToken: string
): AsyncGenerator<string> {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      action: 'chat',
      messages,
      profile,
      todays_summary: todaysSummary,
    }),
  });

  if (!res.ok || !res.body) throw new Error('Chat failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.delta?.text ?? '';
          if (text) yield text;
        } catch {}
      }
    }
  }
}
