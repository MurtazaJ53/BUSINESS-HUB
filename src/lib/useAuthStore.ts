import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { auth } from './firebase';
import { onIdTokenChanged, User } from 'firebase/auth';

const AUTH_INIT_TIMEOUT_MS = 12000;

// 1. Strict Type Definitions matching our Backend Claims
export type AppRole = 'admin' | 'staff' | 'manager' | 'suspended' | null;

interface AuthState {
  // 📦 State
  user: User | null;
  shopId: string | null;
  role: AppRole;
  permissions: Record<string, any> | null;
  isElevatedAdmin: boolean; // Tracks if they successfully entered the Admin PIN
  loading: boolean;
  initialized: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;

  // 🚀 Actions
  initialize: () => void;
  cleanup: () => void;
  clearSession: (errorMessage?: string) => void;
  forceTokenRefresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Initial State
      user: null,
      shopId: null,
      role: null,
      permissions: null,
      isElevatedAdmin: false,
      loading: true, 
      initialized: false,
      error: null,
      unsubscribe: null,

      clearSession: (errorMessage) => {
        set({
          user: null,
          shopId: null,
          role: null,
          permissions: null,
          isElevatedAdmin: false,
          error: errorMessage,
          loading: false,
          initialized: true,
        }, false, 'auth/clearSession');
      },

      forceTokenRefresh: async () => {
        const user = auth.currentUser;
        if (user) {
          set({ loading: true }, false, 'auth/forcingRefresh');
          await user.getIdToken(true); // Forces Firebase to fetch the latest claims
        }
      },

      initialize: () => {
        const { unsubscribe: existingUnsub, clearSession } = get();
        if (existingUnsub) existingUnsub();
        set({ loading: true, initialized: false, error: null }, false, 'auth/booting');

        let authInitTimeout: number | null = null;
        const clearInitTimeout = () => {
          if (authInitTimeout) {
            clearTimeout(authInitTimeout);
            authInitTimeout = null;
          }
        };

        if (typeof window !== 'undefined') {
          authInitTimeout = window.setTimeout(() => {
            console.error('[Auth Initialization Timeout] Session bootstrap exceeded 12 seconds.');
            clearSession('Session startup timed out on this device. Please sign in again.');
          }, AUTH_INIT_TIMEOUT_MS);
        }

        const unsub = onIdTokenChanged(auth, async (user) => {
          clearInitTimeout();
          if (!get().initialized) set({ loading: true }, false, 'auth/loading');

          try {
            if (!user) {
              clearSession();
              return;
            }

            const tokenResult = await user.getIdTokenResult();
            const claims = tokenResult.claims;

            if (claims.role === 'suspended') {
              console.warn(`[Security] User ${user.uid} is suspended. Access blocked.`);
              clearSession('Your account has been suspended by management.');
              return;
            }

            if (!claims.shopId) {
              set({ 
                user, 
                shopId: null, 
                role: null,
                permissions: null,
                isElevatedAdmin: false,
                error: null,
                loading: false, 
                initialized: true 
              }, false, 'auth/newProfilePending');
              return;
            }

            set({
              user,
              shopId: claims.shopId as string,
              role: claims.role as AppRole,
              permissions: claims.perms as Record<string, any> || null,
              isElevatedAdmin: !!claims.shopAdmin,
              error: null,
              loading: false,
              initialized: true,
            }, false, 'auth/sessionEstablished');

          } catch (error: any) {
            console.error('[Auth Initialization Error]:', error);
            clearSession(error.message || 'Failed to initialize secure session.');
          }
        });

        set({
          unsubscribe: () => {
            clearInitTimeout();
            unsub();
          }
        }, false, 'auth/setUnsubscribe');
      },

      cleanup: () => {
        const { unsubscribe } = get();
        if (unsubscribe) {
          unsubscribe();
          set({ unsubscribe: null }, false, 'auth/cleanup');
        }
      },
    }),
    { name: 'AuthStore' }
  )
);
