import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase, db } from '../services/supabase';
import { Profile } from '@nouri/shared/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  setSession: (session) => set({ session, isLoading: false }),
  setProfile: (profile) => set({ profile }),

  loadProfile: async () => {
    const session = get().session;
    if (!session) return;

    const { data } = await db.profiles()
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) set({ profile: data as Profile });
  },

  updateProfile: async (updates) => {
    const session = get().session;
    if (!session) return;

    const { data } = await db.profiles()
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .select()
      .single();

    if (data) set({ profile: data as Profile });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));

// Initialize auth listener
supabase.auth.onAuthStateChange(async (event, session) => {
  useAuthStore.getState().setSession(session);
  if (session) {
    await useAuthStore.getState().loadProfile();
  }
});
