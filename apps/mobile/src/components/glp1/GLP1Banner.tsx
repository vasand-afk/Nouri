import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props { onPress: () => void; }

export default function GLP1Banner({ onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.wrapper} activeOpacity={0.9}>
      <LinearGradient colors={['#7C3AED', '#9D5CF6']} style={styles.banner}>
        <Ionicons name="medical" size={20} color="rgba(255,255,255,0.9)" />
        <View style={styles.text}>
          <Text style={styles.title}>GLP-1 Tracker</Text>
          <Text style={styles.subtitle}>Log injection · Track symptoms · Monitor progress</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  text: { flex: 1 },
  title: { color: '#fff', fontWeight: '700', fontSize: 14 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
});
