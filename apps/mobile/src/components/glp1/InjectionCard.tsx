import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { InjectionLog } from '../../types';

export default function InjectionCard({ injection }: { injection: InjectionLog }) {
  return (
    <View style={styles.card}>
      <View style={[styles.dot, injection.medication_type === 'peptide' && styles.dotPeptide]} />
      <View style={styles.info}>
        <Text style={styles.med}>{injection.medication.split(' ')[0]}</Text>
        <Text style={styles.meta}>
          {injection.dose_mg ? `${injection.dose_mg}mg • ` : ''}
          {injection.injection_site ?? 'Site not logged'} •{' '}
          {format(new Date(injection.injected_at), 'MMM d, h:mm a')}
        </Text>
        {injection.notes && <Text style={styles.notes}>{injection.notes}</Text>}
      </View>
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>{injection.medication_type}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1A6B3C', marginTop: 4 },
  dotPeptide: { backgroundColor: '#7C3AED' },
  info: { flex: 1 },
  med: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  notes: { fontSize: 12, color: '#555', marginTop: 4, fontStyle: 'italic' },
  typeBadge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 10, color: '#555', fontWeight: '700', textTransform: 'uppercase' },
});
