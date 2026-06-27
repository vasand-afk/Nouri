import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Animated, {
  FadeInDown, FadeInUp, SlideInDown,
} from 'react-native-reanimated';

import { supabase } from '../../services/supabase';

WebBrowser.maybeCompleteAuthSession();

const { height } = Dimensions.get('window');

type AuthStep = 'landing' | 'email';

export default function WelcomeScreen() {
  const [step, setStep] = useState<AuthStep>('landing');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  // ── Magic Link ──────────────────────────────────────────────
  const sendMagicLink = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: makeRedirectUri({ scheme: 'nouri', path: 'auth/callback' }),
        data: { app: 'nouri' },
      },
    });

    setIsSending(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setMagicSent(true);
    }
  };

  // ── Apple Sign In ───────────────────────────────────────────
  const signInWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
        nonce: credential.authorizationCode!,
      });

      if (error) Alert.alert('Apple sign-in failed', error.message);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', e.message);
      }
    }
  };

  // ── Google Sign In ──────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: makeRedirectUri({ scheme: 'nouri', path: 'auth/callback' }),
        skipBrowserRedirect: true,
      },
    });

    if (error) { Alert.alert('Error', error.message); return; }
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'nouri://auth/callback');
      if (result.type === 'success') {
        const url = result.url;
        const params = new URLSearchParams(url.split('#')[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    }
  };

  // ── Magic link sent confirmation ────────────────────────────
  if (magicSent) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.magicSentContainer}>
          <LinearGradient colors={['#E8F8EE', '#D4EFD8']} style={styles.magicIconBg}>
            <Ionicons name="mail" size={40} color="#1A6B3C" />
          </LinearGradient>
          <Text style={styles.magicTitle}>Check your email</Text>
          <Text style={styles.magicBody}>
            We sent a magic link to{'\n'}
            <Text style={styles.magicEmail}>{email}</Text>
          </Text>
          <Text style={styles.magicHint}>
            Tap the link in the email to sign in — no password needed.
          </Text>
          <TouchableOpacity style={styles.resendBtn} onPress={() => setMagicSent(false)}>
            <Text style={styles.resendText}>Use a different email</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero gradient */}
      <LinearGradient
        colors={['#1A6B3C', '#27A85F', '#4CAF50']}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.heroContent}>
            {/* Logo */}
            <Text style={styles.logo}>nouri</Text>
            <Text style={styles.tagline}>Your intelligent nutrition companion</Text>

            {/* Feature pills */}
            <View style={styles.pillRow}>
              {['📸 AI Photo Logging', '💉 GLP-1 Tracker', '🤝 Community'].map((f) => (
                <View key={f} style={styles.pill}>
                  <Text style={styles.pillText}>{f}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      {/* Auth card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.authCard}
      >
        <Animated.View entering={SlideInDown.delay(200).duration(500)} style={styles.authInner}>
          <Text style={styles.authTitle}>
            {step === 'landing' ? 'Get started free' : 'Enter your email'}
          </Text>

          {step === 'landing' ? (
            <>
              {/* Apple */}
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={14}
                  style={styles.appleBtn}
                  onPress={signInWithApple}
                />
              )}

              {/* Google */}
              <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle}>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.emailBtn}
                onPress={() => setStep('email')}
              >
                <Ionicons name="mail-outline" size={18} color="#1A6B3C" />
                <Text style={styles.emailBtnText}>Continue with Email</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.emailInputRow}>
                <TextInput
                  style={styles.emailInput}
                  placeholder="your@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  onSubmitEditing={sendMagicLink}
                  returnKeyType="send"
                />
              </View>

              <TouchableOpacity
                style={[styles.magicBtn, isSending && styles.magicBtnDisabled]}
                onPress={sendMagicLink}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.magicBtnText}>Send Magic Link</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep('landing')}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.terms}>
            By continuing you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  hero: { height: height * 0.42, justifyContent: 'flex-end', paddingBottom: 24 },
  heroContent: { paddingHorizontal: 28 },
  logo: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 6, fontWeight: '500' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  authCard: { flex: 1 },
  authInner: {
    flex: 1,
    padding: 28,
    paddingTop: 32,
  },
  authTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 24 },

  appleBtn: { width: '100%', height: 52, marginBottom: 12 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    height: 52,
    gap: 10,
    marginBottom: 20,
  },
  googleG: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EBEBEB' },
  dividerText: { fontSize: 13, color: '#AAA', fontWeight: '500' },

  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
    borderRadius: 14,
    height: 52,
    gap: 8,
  },
  emailBtnText: { fontSize: 15, fontWeight: '700', color: '#1A6B3C' },

  emailInputRow: { marginBottom: 14 },
  emailInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  magicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A6B3C',
    borderRadius: 14,
    height: 52,
    gap: 8,
    marginBottom: 16,
  },
  magicBtnDisabled: { backgroundColor: '#A5D6B7' },
  magicBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  backText: { fontSize: 14, color: '#888', textAlign: 'center' },

  magicSentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  magicIconBg: {
    width: 90,
    height: 90,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  magicTitle: { fontSize: 26, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  magicBody: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24 },
  magicEmail: { fontWeight: '700', color: '#1A1A1A' },
  magicHint: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 16, lineHeight: 20 },
  resendBtn: { marginTop: 28 },
  resendText: { fontSize: 14, color: '#1A6B3C', fontWeight: '600', textDecorationLine: 'underline' },

  terms: { fontSize: 11, color: '#AAA', textAlign: 'center', marginTop: 'auto', lineHeight: 18 },
  termsLink: { color: '#1A6B3C', textDecorationLine: 'underline' },
});
