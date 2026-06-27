import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  body: string;
  icon: any;
  onTap?: () => void;
}

export default function InsightCard({ title, body, icon, onTap }: Props) {
  return (
    <TouchableOpacity
      onPress={onTap}
      activeOpacity={0.85}
      style={styles.wrapper}
    >
      <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.card}>
        <View style={styles.iconRow}>
          <Ionicons name={icon} size={18} color="rgba(255,255,255,0.9)" />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.body}>{body}</Text>
        {onTap && (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Ask your coach</Text>
            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginTop: 8 },
  card: { borderRadius: 16, padding: 18 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 13 },
  body: { color: '#fff', fontSize: 14, lineHeight: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  ctaText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
});
