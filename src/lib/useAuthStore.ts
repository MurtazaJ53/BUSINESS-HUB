import { create } from 'zustand';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  shopId: string | null;
  role: 'admin' | 'staff' | null;
  loading: boolean;
  initialized: boolean;

  setUser: (user: User | null) => void;
  setShopContext: (shopId: string, role: 'admin' | 'staff') => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  shopId: null,
  role: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user, loading: false }),
  
  setShopContext: (shopId, role) => set({ shopId, role }),

  initialize: () => {
    onAuthStateChanged(auth, async (user) => {
      set({ loading: true });
      try {
        if (user) {
          // GUEST SESSION PROTECTION: If user is anonymous, setup "Wipe on Close"
          if (user.isAnonymous) {
            window.addEventListener('beforeunload', () => {
              auth.signOut();
            });
          }

          // Fetch user profile from Firestore to get shop context
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // SECURITY GUARD: If they are a staff member, verify they still exist in the shop's staff roster
            if (data.role === 'staff' && data.shopId) {
              const staffDoc = await getDoc(doc(db, `shops/${data.shopId}/staff`, user.uid));
              if (!staffDoc.exists()) {
                console.warn('RECURSIVE SECURITY: Staff member no longer exists in shop roster. Revoking access.');
                set({ user, shopId: null, role: null, initialized: true });
                return;
              }
            }

            set({ 
              user, 
              shopId: data.shopId, 
              role: data.role, 
              initialized: true 
            });
          } else {
            // New user, verified auth but no shop link in Firestore yet
            set({ user, shopId: null, role: null, initialized: true });
          }
        } else {
          set({ user: null, shopId: null, role: null, initialized: true });
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        set({ user: null, shopId: null, role: null, initialized: true });
      } finally {
        set({ loading: false });
      }
    });
  },
}));
