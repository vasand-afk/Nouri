import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProteinGoalBanner({
  proteinTarget,
  isGlp1User,
}: {
  proteinTarget: number;
  isGlp1User: boolean;
}) {
  if (!isGlp1User) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="barbell" size={20} color="#1A6B3C" />
      <View style={styles.text}>
        <Text style={styles.title}>Protein First 💪</Text>
        <Text style={styles.body}>
          Your {proteinTarget}g/day target is elevated to protect muscle while appetite is suppressed.
          Aim for 30g+ per meal with high-quality sources like eggs, Greek yogurt, chicken, or protein shakes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F0FBF5',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#1A6B3C',
  },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  body: { fontSize: 12, color: '#555', lineHeight: 18 },
});
