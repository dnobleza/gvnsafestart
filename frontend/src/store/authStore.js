import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  status: 'checking',
  setSession: ({ user, accessToken }) => set({ user, accessToken, status: 'authenticated' }),
  clearSession: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));
