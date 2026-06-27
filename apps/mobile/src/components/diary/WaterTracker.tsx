import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const QUICK_AMOUNTS = [150, 250, 350, 500];

interface Props {
  currentMl: number;
  targetMl: number;
  onAdd: (ml: number) => void;
}

export default function WaterTracker({ currentMl, targetMl, onAdd }: Props) {
  const pct = Math.min(1, currentMl / Math.max(1, targetMl));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="water" size={18} color="#2196F3" />
          <Text style={styles.label}>Water</Text>
          <Text style={styles.value}>{(currentMl / 1000).toFixed(1)}L</Text>
          <Text style={styles.target}>/ {(targetMl / 1000).toFixed(1)}L</Text>
        </View>
        <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>

      <View style={styles.btns}>
        {QUICK_AMOUNTS.map((ml) => (
          <TouchableOpacity key={ml} style={styles.btn} onPress={() => onAdd(ml)}>
            <Ionicons name="add" size={12} color="#2196F3" />
            <Text style={styles.btnText}>{ml}ml</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#EFF8FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  value: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  target: { fontSize: 12, color: '#888' },
  pct: { fontSize: 13, fontWeight: '700', color: '#2196F3' },
  track: { height: 6, backgroundColor: '#BFDBFE', borderRadius: 3, marginBottom: 10 },
  fill: { height: 6, backgroundColor: '#2196F3', borderRadius: 3 },
  btns: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 6,
    gap: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  btnText: { fontSize: 12, color: '#2196F3', fontWeight: '600' },
});
