import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { session, profile } = useAuthStore();

  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!profile?.goal) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
