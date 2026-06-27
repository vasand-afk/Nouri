'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { createClient } from '@supabase/supabase-js';
import {
  Flame, Droplets, Dumbbell, TrendingUp, TrendingDown,
  Apple, Users, Star, ChevronRight, Zap,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WeeklySummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

export default function UserDashboard() {
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [recentMeasurements, setRecentMeasurements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date(),
    }).map(d => format(d, 'yyyy-MM-dd'));

    const [profileRes, summariesRes, measurementsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .gte('summary_date', last30Days[0])
        .order('summary_date'),
      supabase.from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(30),
    ]);

    setProfile(profileRes.data);

    const summaryMap = new Map(
      (summariesRes.data ?? []).map((s: any) => [s.summary_date, s])
    );

    const filled: WeeklySummary[] = last30Days.map(date => {
      const s: any = summaryMap.get(date);
      return {
        date: format(new Date(date), 'MMM d'),
        calories: s?.total_calories ?? 0,
        protein: s?.total_protein_g ?? 0,
        carbs: s?.total_carbs_g ?? 0,
        fat: s?.total_fat_g ?? 0,
        water: s?.water_ml ?? 0,
      };
    });

    setSummaries(filled);
    setRecentMeasurements((measurementsRes.data ?? []) as any[]);
    setIsLoading(false);
  };

  const last7 = summaries.slice(-7);
  const todaySummary = summaries[summaries.length - 1];
  const avgCalories = last7.length
    ? Math.round(last7.reduce((s, d) => s + d.calories, 0) / last7.length)
    : 0;

  const calorieTarget = profile?.daily_calories_target ?? 2000;
  const proteinTarget = profile?.protein_target_g ?? 150;
  const todayProteinPct = Math.min(100, Math.round(((todaySummary?.protein ?? 0) / proteinTarget) * 100));

  const weightData = recentMeasurements
    .filter(m => m.weight_kg)
    .slice(0, 12)
    .reverse()
    .map(m => ({
      date: format(new Date(m.measured_at), 'MMM d'),
      weight: m.weight_kg,
      fat: m.body_fat_pct,
      muscle: m.muscle_mass_kg,
    }));

  const macroData = [
    { name: 'Protein', value: todaySummary?.protein ?? 0, color: '#4CAF50' },
    { name: 'Carbs', value: todaySummary?.carbs ?? 0, color: '#FF9800' },
    { name: 'Fat', value: todaySummary?.fat ?? 0, color: '#2196F3' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1A6B3C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      {/* Sidebar */}
      <div className="flex">
        <aside className="w-64 h-screen bg-white border-r border-gray-100 fixed flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-black text-[#1A6B3C]">nouri</h1>
            <p className="text-xs text-gray-400 mt-1">Nutrition Dashboard</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {[
              { icon: <Flame size={18} />, label: 'Dashboard', active: true },
              { icon: <Apple size={18} />, label: 'Food Diary' },
              { icon: <Dumbbell size={18} />, label: 'Body Tracking' },
              { icon: <Zap size={18} />, label: 'GLP-1 Tracker' },
              { icon: <Users size={18} />, label: 'Community' },
              { icon: <Star size={18} />, label: 'Recipes' },
              { icon: <TrendingUp size={18} />, label: 'Analytics' },
            ].map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-[#E8F8EE] text-[#1A6B3C]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E8F8EE] flex items-center justify-center">
                <span className="text-xs font-bold text-[#1A6B3C]">
                  {profile?.display_name?.[0] ?? profile?.username?.[0] ?? '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {profile?.display_name ?? profile?.username}
                </p>
                <p className="text-xs text-gray-400">
                  {profile?.is_premium ? '✨ Premium' : 'Free plan'}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="ml-64 flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Good {getGreeting()}, {profile?.display_name?.split(' ')[0] ?? 'there'}!
              </h2>
              <p className="text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            {profile?.is_glp1_user && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-2 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm font-medium text-red-600">GLP-1 Journey Active</span>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <KPICard
              title="Today's Calories"
              value={`${(todaySummary?.calories ?? 0).toFixed(0)}`}
              unit={`/ ${calorieTarget} kcal`}
              trend={todaySummary?.calories > calorieTarget * 0.9 ? 'good' : 'warn'}
              icon={<Flame className="text-orange-500" size={20} />}
            />
            <KPICard
              title="Protein"
              value={`${(todaySummary?.protein ?? 0).toFixed(0)}g`}
              unit={`/ ${proteinTarget}g (${todayProteinPct}%)`}
              trend={todayProteinPct >= 80 ? 'good' : 'warn'}
              icon={<Dumbbell className="text-green-600" size={20} />}
            />
            <KPICard
              title="Water"
              value={`${((todaySummary?.water ?? 0) / 1000).toFixed(1)}L`}
              unit="today"
              trend="neutral"
              icon={<Droplets className="text-blue-500" size={20} />}
            />
            <KPICard
              title="7-Day Avg"
              value={`${avgCalories}`}
              unit="kcal/day"
              trend="neutral"
              icon={<TrendingUp className="text-purple-500" size={20} />}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Calorie trend */}
            <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Calorie Trend (30 days)</h3>
                <span className="text-xs text-gray-400">Target: {calorieTarget} kcal</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={summaries}>
                  <defs>
                    <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1A6B3C" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1A6B3C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, calorieTarget * 1.3]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="calories"
                    stroke="#1A6B3C"
                    fill="url(#colorCal)"
                    strokeWidth={2}
                    dot={false}
                  />
                  {/* Target line */}
                  <Line
                    type="monotone"
                    dataKey={() => calorieTarget}
                    stroke="#DC2626"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Today's macro split */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Today's Macros</h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {macroData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}g`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {macroData.map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-gray-600">{m.name}</span>
                    </div>
                    <span className="font-semibold">{m.value.toFixed(0)}g</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Protein trend + weight */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Protein (7 days)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="protein" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {weightData.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4">Weight Trend</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#1A6B3C"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    {weightData.some(d => d.muscle) && (
                      <Line
                        type="monotone"
                        dataKey="muscle"
                        stroke="#4CAF50"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function KPICard({
  title, value, unit, trend, icon,
}: {
  title: string; value: string; unit: string; trend: 'good' | 'warn' | 'neutral'; icon: React.ReactNode;
}) {
  const trendColor = trend === 'good' ? 'text-green-600 bg-green-50' : trend === 'warn' ? 'text-yellow-600 bg-yellow-50' : 'text-gray-600 bg-gray-50';

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <div className={`p-1.5 rounded-lg ${trendColor}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{unit}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
