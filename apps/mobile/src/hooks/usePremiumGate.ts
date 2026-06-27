import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { canUseFeature, PremiumFeature } from '../services/premium';

/**
 * Returns a function you can call before any premium action.
 * If the user is allowed, runs the callback immediately.
 * If not, navigates to the paywall screen with the triggering feature context.
 *
 * Usage:
 *   const gate = usePremiumGate();
 *   gate('ai_meal_plan', () => router.push('/meal-plan'));
 */
export function usePremiumGate() {
  const router = useRouter();
  const { profile } = useAuthStore();

  const gate = useCallback(
    (feature: PremiumFeature, action: () => void) => {
      if (canUseFeature(feature, profile)) {
        action();
      } else {
        router.push({ pathname: '/paywall', params: { feature } });
      }
    },
    [profile, router]
  );

  return gate;
}
