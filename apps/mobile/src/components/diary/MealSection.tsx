import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DiaryEntry, MealType } from '@nouri/shared/types';

const MEAL_CONFIG: Record<MealType, { label: string; icon: any; color: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny', color: '#FF9800' },
  lunch: { label: 'Lunch', icon: 'partly-sunny', color: '#4CAF50' },
  dinner: { label: 'Dinner', icon: 'moon', color: '#3F51B5' },
  snack: { label: 'Snack', icon: 'nutrition', color: '#E91E63' },
  pre_workout: { label: 'Pre-Workout', icon: 'fitness', color: '#9C27B0' },
  post_workout: { label: 'Post-Workout', icon: 'barbell', color: '#00BCD4' },
};

interface Props {
  mealType: MealType;
  entries: DiaryEntry[];
  onAdd: () => void;
}

export default function MealSection({ mealType, entries, onAdd }: Props) {
  const [expanded, setExpanded] = useState(true);
  const config = MEAL_CONFIG[mealType];

  const totalCalories = entries.reduce((s, e) => s + (e.calories ?? 0), 0);
  const totalProtein = entries.reduce((s, e) => s + (e.protein_g ?? 0), 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: `${config.color}18` }]}>
            <Ionicons name={config.icon} size={16} color={config.color} />
          </View>
          <View>
            <Text style={styles.mealName}>{config.label}</Text>
            {entries.length > 0 && (
              <Text style={styles.mealStats}>
                {totalCalories.toFixed(0)} kcal • {totalProtein.toFixed(0)}g protein
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Ionicons name="add" size={18} color="#1A6B3C" />
          </TouchableOpacity>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#CCC"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entriesContainer}>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
          {entries.length === 0 && (
            <TouchableOpacity style={styles.emptyRow} onPress={onAdd}>
              <Text style={styles.emptyText}>Tap + to log {config.label.toLowerCase()}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function EntryRow({ entry }: { entry: DiaryEntry }) {
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryLeft}>
        <Text style={styles.entryName} numberOfLines={1}>{entry.food_name}</Text>
        <Text style={styles.entryAmount}>{entry.amount_g}g</Text>
      </View>
      <View style={styles.entryRight}>
        <Text style={styles.entryCalories}>{(entry.calories ?? 0).toFixed(0)}</Text>
        <Text style={styles.entryCalUnit}>kcal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mealName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  mealStats: { fontSize: 11, color: '#999', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E8F8EE',
    alignItems: 'center', justifyContent: 'center',
  },
  entriesContainer: { borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  entryLeft: { flex: 1, marginRight: 12 },
  entryName: { fontSize: 13, color: '#333', fontWeight: '500' },
  entryAmount: { fontSize: 11, color: '#AAA', marginTop: 2 },
  entryRight: { alignItems: 'flex-end' },
  entryCalories: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  entryCalUnit: { fontSize: 10, color: '#AAA' },
  emptyRow: { padding: 14, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#CCC' },
});
