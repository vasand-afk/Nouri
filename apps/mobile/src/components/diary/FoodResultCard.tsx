import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Food } from '@nouri/shared/types';

interface Props {
  food: Food | any;
  onLog: (amountG: number) => void;
}

export default function FoodResultCard({ food, onLog }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState(
    food.serving_size_g?.toString() ?? food.estimated_g?.toString() ?? '100'
  );

  const amountG = parseFloat(amount) || 100;
  const factor = amountG / 100;

  const calories = ((food.calories_per_100g ?? food.calories ?? 0) * factor).toFixed(0);
  const protein = ((food.protein_per_100g ?? food.protein_g ?? 0) * factor).toFixed(1);
  const carbs = ((food.carbs_per_100g ?? food.carbs_g ?? 0) * factor).toFixed(1);
  const fat = ((food.fat_per_100g ?? food.fat_g ?? 0) * factor).toFixed(1);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.foodInfo}>
          <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
          {food.brand && <Text style={styles.brand}>{food.brand}</Text>}
          {food.confidence !== undefined && (
            <Text style={styles.confidence}>
              {Math.round(food.confidence * 100)}% confidence
            </Text>
          )}
        </View>
        <View style={styles.calBadge}>
          <Text style={styles.calText}>{calories}</Text>
          <Text style={styles.calUnit}>kcal</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          <View style={styles.macroRow}>
            <MacroChip label="Protein" value={protein} color="#4CAF50" />
            <MacroChip label="Carbs" value={carbs} color="#FF9800" />
            <MacroChip label="Fat" value={fat} color="#2196F3" />
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount (g)</Text>
            <View style={styles.amountInput}>
              <TouchableOpacity onPress={() => setAmount(String(Math.max(1, amountG - 10)))}>
                <Ionicons name="remove" size={18} color="#555" />
              </TouchableOpacity>
              <TextInput
                style={styles.amountText}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <TouchableOpacity onPress={() => setAmount(String(amountG + 10))}>
                <Ionicons name="add" size={18} color="#555" />
              </TouchableOpacity>
            </View>
          </View>

          {food.serving_size_g && (
            <TouchableOpacity
              style={styles.servingBtn}
              onPress={() => setAmount(food.serving_size_g.toString())}
            >
              <Text style={styles.servingBtnText}>
                Use serving: {food.serving_description ?? `${food.serving_size_g}g`}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logBtn} onPress={() => onLog(amountG)}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.logBtnText}>Log {calories} kcal</Text>
          </TouchableOpacity>
        </View>
      )}

      {!expanded && (
        <TouchableOpacity style={styles.quickLogBtn} onPress={() => onLog(amountG)}>
          <Ionicons name="add" size={16} color="#1A6B3C" />
          <Text style={styles.quickLogText}>Quick add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.macroChip}>
      <Text style={[styles.macroValue, { color }]}>{value}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  foodInfo: { flex: 1, marginRight: 12 },
  foodName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  brand: { fontSize: 12, color: '#999', marginTop: 2 },
  confidence: { fontSize: 11, color: '#27A85F', marginTop: 2 },
  calBadge: { alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8, padding: 8 },
  calText: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  calUnit: { fontSize: 10, color: '#999' },
  details: { borderTopWidth: 1, borderTopColor: '#F5F5F5', padding: 14 },
  macroRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  macroChip: { flex: 1, alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10 },
  macroValue: { fontSize: 15, fontWeight: '700' },
  macroLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  amountLabel: { fontSize: 14, color: '#555', fontWeight: '500' },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 6,
    gap: 12,
  },
  amountText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', minWidth: 48, textAlign: 'center' },
  servingBtn: { marginBottom: 10 },
  servingBtnText: { fontSize: 12, color: '#1A6B3C', textDecorationLine: 'underline' },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 4,
  },
  quickLogText: { fontSize: 13, color: '#1A6B3C', fontWeight: '600' },
});
