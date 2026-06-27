import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../stores/authStore';
import {
  PREMIUM_FEATURE_DESCRIPTIONS,
  PREMIUM_PLANS,
  PremiumFeature,
  PREMIUM_ENABLED,
} from '../../services/premium';

// When Stripe is ready: import { useStripe } from '@stripe/stripe-react-native';

interface Props {
  triggerFeature?: PremiumFeature; // Which feature triggered this paywall
  onDismiss?: () => void;
}

export default function PaywallScreen({ triggerFeature, onDismiss }: Props) {
  const router = useRouter();
  const { profile, updateProfile, session } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);

  const highlightedFeature = triggerFeature
    ? PREMIUM_FEATURE_DESCRIPTIONS[triggerFeature]
    : null;

  const handleSubscribe = async () => {
    if (!PREMIUM_ENABLED) {
      // During free launch: just grant premium without payment
      Alert.alert(
        'Not yet available',
        'Premium subscriptions will be available soon. Stay tuned!',
      );
      return;
    }

    // TODO: Implement Stripe payment when ready
    // const { initPaymentSheet, presentPaymentSheet } = useStripe();
    //
    // 1. Call your Supabase edge function to create a Stripe payment intent
    // 2. Init the payment sheet
    // 3. Present it
    // 4. On success, update profile.is_premium = true and create subscription row

    setIsPurchasing(true);

    try {
      // Placeholder: simulate purchase flow
      const plan = PREMIUM_PLANS.find(p => p.id === selectedPlan)!;

      // Call edge function to create Stripe checkout
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ price_id: plan.stripePriceId }),
        }
      );

      if (!res.ok) throw new Error('Failed to create subscription');

      const { client_secret } = await res.json();

      // Present Stripe payment sheet (requires @stripe/stripe-react-native setup)
      // const { error } = await presentPaymentSheet();
      // if (error) throw error;

      // Update profile
      await updateProfile({ is_premium: true });
      Alert.alert('Welcome to Nouri Premium! 🎉', 'All features are now unlocked.');
      onDismiss ? onDismiss() : router.back();
    } catch (err: any) {
      Alert.alert('Purchase failed', err?.message ?? 'Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const FEATURES_TO_SHOW: PremiumFeature[] = [
    'ai_meal_plan',
    'ai_diary_analysis',
    'pantry_suggestions',
    'advanced_analytics',
    'cgm_integration',
    'wearable_sync',
    'coach_marketplace',
    'unlimited_recipes',
    'export_data',
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['#1A6B3C', '#27A85F', '#4CAF50']} style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onDismiss ?? (() => router.back())}
            >
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>

            <View style={styles.heroContent}>
              <View style={styles.crownBadge}>
                <Ionicons name="diamond" size={28} color="#FFD700" />
              </View>
              <Text style={styles.heroTitle}>Nouri Premium</Text>
              <Text style={styles.heroSubtitle}>
                {highlightedFeature
                  ? `Unlock ${highlightedFeature.title} and much more`
                  : 'Unlock your full nutrition potential'}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Triggered feature highlight */}
        {highlightedFeature && (
          <View style={styles.triggerCard}>
            <Ionicons name={highlightedFeature.icon as any} size={22} color="#1A6B3C" />
            <View style={{ flex: 1 }}>
              <Text style={styles.triggerTitle}>{highlightedFeature.title}</Text>
              <Text style={styles.triggerDesc}>{highlightedFeature.desc}</Text>
            </View>
          </View>
        )}

        {/* Plan selector */}
        <View style={styles.plans}>
          {PREMIUM_PLANS.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, selectedPlan === plan.id && styles.planCardActive]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <View style={styles.planLeft}>
                <View style={[styles.planRadio, selectedPlan === plan.id && styles.planRadioActive]}>
                  {selectedPlan === plan.id && <View style={styles.planRadioDot} />}
                </View>
                <View>
                  <Text style={styles.planLabel}>{plan.label}</Text>
                  {'originalPrice' in plan && plan.originalPrice && (
                    <Text style={styles.originalPrice}>${plan.originalPrice}/mo</Text>
                  )}
                </View>
              </View>
              <View style={styles.planRight}>
                <Text style={styles.planPrice}>${plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
                {plan.badge && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Features list */}
        <View style={styles.featureList}>
          <Text style={styles.featureListTitle}>Everything included</Text>
          {FEATURES_TO_SHOW.map(f => {
            const feat = PREMIUM_FEATURE_DESCRIPTIONS[f];
            return (
              <View key={f} style={styles.featureRow}>
                <View style={styles.featureIconBox}>
                  <Ionicons name={feat.icon as any} size={16} color="#1A6B3C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{feat.title}</Text>
                  <Text style={styles.featureDesc}>{feat.desc}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color="#1A6B3C" />
              </View>
            );
          })}
        </View>

        {/* Social proof */}
        <View style={styles.socialProof}>
          <Text style={styles.socialProofText}>
            ⭐️ Loved by 50,000+ users including thousands on GLP-1 medications
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, isPurchasing && styles.ctaBtnDisabled]}
          onPress={handleSubscribe}
          disabled={isPurchasing}
        >
          <LinearGradient colors={['#1A6B3C', '#27A85F']} style={styles.ctaBtnGrad}>
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="diamond" size={18} color="#FFD700" />
                <Text style={styles.ctaBtnText}>
                  Start Premium — ${PREMIUM_PLANS.find(p => p.id === selectedPlan)?.price}/
                  {selectedPlan === 'annual' ? 'mo' : 'mo'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.ctaNote}>
          {selectedPlan === 'annual' ? 'Billed $59.99/year · ' : ''}
          Cancel anytime · Secure payment
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  hero: { paddingBottom: 32 },
  closeBtn: {
    alignSelf: 'flex-end', margin: 16,
    backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  heroContent: { alignItems: 'center', paddingHorizontal: 24 },
  crownBadge: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22 },
  triggerCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#F0FBF5', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#D4EFD8',
  },
  triggerTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  triggerDesc: { fontSize: 13, color: '#555', lineHeight: 18 },
  plans: { padding: 16, gap: 10 },
  planCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 16, borderWidth: 2, borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  planCardActive: { borderColor: '#1A6B3C', backgroundColor: '#F0FBF5' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#CCC',
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioActive: { borderColor: '#1A6B3C' },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1A6B3C' },
  planLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  originalPrice: { fontSize: 12, color: '#AAA', textDecorationLine: 'line-through' },
  planRight: { alignItems: 'flex-end' },
  planPrice: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  planPeriod: { fontSize: 12, color: '#888' },
  planBadge: {
    backgroundColor: '#1A6B3C', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
  },
  planBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  featureList: { paddingHorizontal: 16, paddingTop: 8 },
  featureListTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 14 },
  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16,
  },
  featureIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F0FBF5', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  featureDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  socialProof: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14,
  },
  socialProofText: { fontSize: 13, color: '#92400E', textAlign: 'center', lineHeight: 19 },
  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  ctaBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 8 },
  ctaBtnDisabled: { opacity: 0.7 },
  ctaBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ctaNote: { textAlign: 'center', fontSize: 11, color: '#AAA' },
});
