import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  consumed: number;
  target: number;
  size: number;
  color: string;
  label: string;
  centerText: string;
  centerLabel: string;
}

export default function MacroRing({ consumed, target, size, color, label, centerText, centerLabel }: Props) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, consumed / Math.max(1, target));
  const strokeDashoffset = circumference * (1 - pct);
  const isOver = consumed > target;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8E8E8"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isOver ? '#EF4444' : color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <Text style={[styles.centerText, { color: isOver ? '#EF4444' : '#1A1A1A' }]}>
        {centerText}
      </Text>
      <Text style={styles.centerLabel}>{centerLabel}</Text>
      <Text style={styles.centerUnit}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerText: { fontSize: 22, fontWeight: '800' },
  centerLabel: { fontSize: 10, color: '#999', marginTop: 1 },
  centerUnit: { fontSize: 11, color: '#666', fontWeight: '600' },
});
