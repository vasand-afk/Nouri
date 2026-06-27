import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0';
import { createClient } from 'npm:@supabase/supabase-js@2.43.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const SYSTEM_PROMPT = `You are Nouri Coach, an expert AI nutrition assistant within the Nouri app. You have deep expertise in:
- Sports nutrition and body composition
- GLP-1 medications (semaglutide/Ozempic, tirzepatide/Mounjaro) and peptides (BPC-157, TB-500)
- Weight management and metabolic health
- Meal planning, recipe creation, and practical cooking
- Micronutrient optimization and blood sugar management

Key behaviors:
- Be warm, encouraging, and science-based
- For GLP-1 users: always emphasize protein-first eating (1.6–2g/kg), small frequent meals to manage nausea, and monitoring for muscle loss
- Provide specific, actionable advice with portion sizes and food examples
- Never recommend stopping medications — always defer to their prescriber for medical decisions
- Format responses with clear structure when giving meal plans or lists
- Keep responses concise but complete — aim for 150–300 words unless more detail is specifically needed

You have access to the user's profile and today's nutrition summary. Use this context to personalize every response.`;

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify JWT
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const { action } = body;

  // ── Food Photo Recognition ────────────────────────────────
  if (action === 'recognize_food') {
    const { image_base64 } = body;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: image_base64 },
          },
          {
            type: 'text',
            text: `Analyze this food image and identify all visible food items. For each item, provide:
- name (specific, e.g. "grilled chicken breast" not just "chicken")
- estimated_g (weight in grams, be specific based on visual portion size)
- calories, protein_g, carbs_g, fat_g, fiber_g (per the estimated portion)
- confidence (0-1)

Respond with ONLY valid JSON in this exact format:
{
  "foods": [
    {
      "name": "string",
      "estimated_g": number,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "confidence": number
    }
  ],
  "meal_description": "Brief 1-sentence description of the overall meal"
}`,
          },
        ],
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return new Response('{}', { status: 500 });

    try {
      const parsed = JSON.parse(content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ foods: [], meal_description: 'Could not analyze image' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ── Voice → Food Parse ────────────────────────────────────
  if (action === 'parse_voice') {
    const { transcript } = body;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Parse this food description into structured data: "${transcript}"

Respond with ONLY valid JSON:
[
  {
    "name": "specific food name",
    "amount": "user's described amount",
    "estimated_g": number,
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number
  }
]`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return new Response('[]', { status: 500 });

    try {
      const parsed = JSON.parse(content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // ── Pantry Suggestions ────────────────────────────────────
  if (action === 'pantry_suggestions') {
    const { pantry_items, profile } = body;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `User has these ingredients: ${pantry_items.join(', ')}

User profile:
- Goal: ${profile?.goal}
- Protein target: ${profile?.protein_target_g}g/day
- Dietary preferences: ${profile?.dietary_preferences?.join(', ') || 'none'}
- GLP-1 user: ${profile?.is_glp1_user}

Suggest 3 recipes they can make. Respond with ONLY valid JSON:
[
  {
    "title": "string",
    "description": "string",
    "prep_time_min": number,
    "tags": ["string"],
    "nutrition_per_serving": {
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number
    },
    "steps": ["step 1", "step 2", ...]
  }
]`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return new Response('[]', { status: 500 });

    try {
      const parsed = JSON.parse(content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // ── Generate Meal Plan ────────────────────────────────────
  if (action === 'generate_meal_plan') {
    const { profile, preferences } = body;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Generate a ${preferences.days}-day meal plan.

User profile:
- Calorie target: ${profile?.daily_calories_target} kcal
- Protein target: ${profile?.protein_target_g}g
- Carbs target: ${profile?.carbs_target_g}g
- Fat target: ${profile?.fat_target_g}g
- Goal: ${profile?.goal}
- Dietary preferences: ${profile?.dietary_preferences?.join(', ') || 'none'}
- Allergies: ${profile?.allergies?.join(', ') || 'none'}
- GLP-1 user: ${profile?.is_glp1_user ? 'yes (prioritize protein, small portions, easy to digest)' : 'no'}
${preferences.avoid_ingredients?.length ? `- Avoid: ${preferences.avoid_ingredients.join(', ')}` : ''}
${preferences.pantry_items?.length ? `- Has in pantry: ${preferences.pantry_items.join(', ')}` : ''}
${preferences.max_prep_time_min ? `- Max prep time: ${preferences.max_prep_time_min} minutes` : ''}

Return a structured ${preferences.days}-day meal plan with breakfast, lunch, dinner, and 1 snack per day. For each meal include name, estimated calories, protein_g, and brief prep notes.`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return new Response('{}', { status: 500 });

    return new Response(JSON.stringify({ plan: content.text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Chat (streaming) ──────────────────────────────────────
  if (action === 'chat') {
    const { messages, profile, todays_summary } = body;

    const userContext = `
User context:
- Name: ${profile?.display_name ?? profile?.username}
- Goal: ${profile?.goal?.replace('_', ' ')}
- Daily targets: ${profile?.daily_calories_target} kcal, ${profile?.protein_target_g}g protein
- GLP-1 user: ${profile?.is_glp1_user ? `Yes (${profile?.glp1_medication})` : 'No'}
- Dietary preferences: ${profile?.dietary_preferences?.join(', ') || 'none'}
${todays_summary ? `
Today's intake so far:
- Calories: ${todays_summary.total_calories.toFixed(0)} / ${profile?.daily_calories_target}
- Protein: ${todays_summary.total_protein_g.toFixed(0)}g / ${profile?.protein_target_g}g
- Carbs: ${todays_summary.total_carbs_g.toFixed(0)}g / ${profile?.carbs_target_g}g
- Fat: ${todays_summary.total_fat_g.toFixed(0)}g / ${profile?.fat_target_g}g
` : ''}`;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + '\n\n' + userContext,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const data = `data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
});
