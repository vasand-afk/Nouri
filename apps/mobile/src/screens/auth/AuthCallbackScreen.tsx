import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';

/**
 * Handles the magic link deep-link callback.
 * Expo Router calls this when the app is opened via nouri://auth/callback#access_token=...
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    // Supabase magic links come as fragments — expo-router exposes them as params
    const access_token = params.access_token as string | undefined;
    const refresh_token = params.refresh_token as string | undefined;

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!error) {
        router.replace('/');
        return;
      }
    }

    // Fallback: just go home and let the auth state listener handle it
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1A6B3C" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 16 },
  text: { fontSize: 15, color: '#555' },
});
