import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
// NOTE: @react-native-community/slider is in package.json. If you prefer zero-dep,
// swap for a custom TouchableOpacity-based slider below.

interface Props {
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}

export default function SideEffectSlider({ label, emoji, value, onChange, lowLabel, highLabel }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{value}/10</Text>
        </View>
      </View>
      <Slider
        style={{ height: 36 }}
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#1A6B3C"
        maximumTrackTintColor="#E0E0E0"
        thumbTintColor="#1A6B3C"
      />
      <View style={styles.labels}>
        <Text style={styles.rangeLabel}>{lowLabel}</Text>
        <Text style={styles.rangeLabel}>{highLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  emoji: { fontSize: 20 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  badge: { backgroundColor: '#E8F8EE', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, color: '#1A6B3C', fontWeight: '700' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  rangeLabel: { fontSize: 11, color: '#AAA' },
});
