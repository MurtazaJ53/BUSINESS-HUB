import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogIn, Mail, Lock, Store, ArrowRight, ShieldCheck,
  ShoppingBag, Sparkles, LogOut, Globe, AlertCircle
} from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { auth, db, googleProvider } from '@/lib/firebase';
import { FirebaseError } from 'firebase/app';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signInWithPopup, signInWithRedirect, getRedirectResult,
  sendPasswordResetEmail, User
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '@/lib/useAuthStore';
import { ADMIN_PERMISSION_TEMPLATE, getRolePermissions, normalizePermissionMatrix } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// --- 🛠️ 1. TYPE DEFINITIONS & ERROR MAPPING ---
type AuthMode = 'login' | 'setup' | 'join' | 'forgot';

const getReadableError = (error: unknown): string => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use': return 'This email is already registered. Please Sign In.';
      case 'auth/invalid-credential': return 'Invalid email or password combination.';
      case 'auth/user-not-found': return 'No account found with this email.';
      case 'auth/wrong-password': return 'Incorrect password provided.';
      case 'auth/network-request-failed': return 'Network error. Please check your connection.';
      default: return error.message;
    }
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, shopId, initialized } = useAuthStore();
  
  // UI State
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    shopName: '',
    joinCode: '',
    staffName: '',
    staffPhone: ''
  });

  const needsShopSetup = user && !shopId && initialized;

  const updateForm = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- 🔄 2. LIFECYCLE & CAPACITOR FAIL-SAFES ---
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) window.location.reload();
      } catch (err) {
        if (err instanceof FirebaseError && err.code !== 'auth/no-auth-event') {
          setError(getReadableError(err));
        }
      }
    };
    handleRedirectResult();

    return () => {
    };
  }, [loading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setMode('join');
      updateForm('joinCode', invite);
    }
  }, []);

  useEffect(() => {
    const performRecovery = async () => {
      if (needsShopSetup && mode === 'login') {
        // One last check: Does this user have a shop in Firestore?
        try {
          const shopsQ = query(collection(db, 'shops'), where('ownerId', '==', user.uid));
          const shopsSnap = await getDocs(shopsQ);
          if (!shopsSnap.empty) {
             const recoveredShopId = shopsSnap.docs[0].id;
             console.info("Auth: Background recovery found shop:", recoveredShopId);
             await setDoc(doc(db, 'users', user.uid), { shopId: recoveredShopId, role: 'admin' }, { merge: true });
             // Wait for claims to propagate or force a refresh
             return;
          }
        } catch (e) {
          console.error("Recovery check failed:", e);
        }
        setMode('setup');
      }
    };
    performRecovery();
  }, [needsShopSetup, mode, user]);

  // --- 🔒 3. AUTHENTICATION CONTROLLERS ---
  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      const isMobile = typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform() !== 'web';
      let user: User | null = null;

      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        return; // Redirect will handle the rest
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        user = result.user;
      }

      if (user) {
        // Automatic Recovery Check: Did this user already create a shop?
        // This prevents the "redirection loop" where users get stuck on the setup screen
        const shopsQ = query(collection(db, 'shops'), where('ownerId', '==', user.uid));
        const shopsSnap = await getDocs(shopsQ);
        
        if (!shopsSnap.empty) {
          const recoveredShopId = shopsSnap.docs[0].id;
          console.info("Auth: Found existing shop ownership during login:", recoveredShopId);
          
          const timestamp = new Date().toISOString();
          // Silently update the users doc to point to their existing shop
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            shopId: recoveredShopId,
            role: 'admin',
            updatedAt: timestamp
          }, { merge: true });

          // Note: The useAuthStore will detect the new shopId claim after a short delay or refresh
          // But to be immediate, we can force a token refresh here if we want.
          // For now, the existing reload logic in useEffect will handle it.
          window.location.reload(); 
        }
      }

    } catch (err) {
      setError(getReadableError(err));
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return setError('Please enter your email address first.');
    
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetSent(true);
    } catch (err) {
      setError(getReadableError(err));
    } finally {
      setLoading(false);
    }
  };

  // --- 🏢 4. DATABASE ABSTRACTIONS (Separation of Concerns) ---
  const provisionNewShop = async (currentUser: User) => {
    setLoading(true);
    try {
      // 1. Recovery Check: Did this user already create a shop?
      const shopsQ = query(collection(db, 'shops'), where('ownerId', '==', currentUser.uid));
      const shopsSnap = await getDocs(shopsQ);
      
      let finalShopId = '';
      if (!shopsSnap.empty) {
        finalShopId = shopsSnap.docs[0].id;
        console.log("Shop Recovery: Found existing shop ownership:", finalShopId);
      } else {
        finalShopId = `shop-${Date.now()}`;
        const timestamp = new Date().toISOString();

        await setDoc(doc(db, 'shops', finalShopId), {
          name: formData.shopName || 'My Business Hub',
          ownerId: currentUser.uid,
          createdAt: timestamp,
          settings: { currency: 'INR' },
          shopId: finalShopId
        });
      }

      const timestamp = new Date().toISOString();
      const updatedAt = Date.now();
      await setDoc(doc(db, 'users', currentUser.uid), {
        email: currentUser.email,
        shopId: finalShopId,
        role: 'admin',
        createdAt: timestamp
      }, { merge: true });

      await setDoc(doc(db, `shops/${finalShopId}/staff`, currentUser.uid), {
        id: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Owner',
        email: currentUser.email,
        phone: '-',
        role: 'admin',
        status: 'active',
        joinedAt: timestamp,
        permissions: ADMIN_PERMISSION_TEMPLATE,
        updatedAt,
      }, { merge: true });

      // Link Owner's Private Data (Salary, PIN)
      await setDoc(doc(db, `shops/${finalShopId}/staff_private`, currentUser.uid), {
        id: currentUser.uid,
        salary: 0,
        updatedAt
      }, { merge: true });

      // Ensure the private auth doc exists for future PIN rotations
      await setDoc(doc(db, `shops/${finalShopId}/private/auth`), {
        initializedAt: timestamp,
        initializedBy: currentUser.uid
      }, { merge: true });

    } catch (err) {
      console.error("Provisioning failed:", err);
      throw err;
    }
  };

  const processShopJoin = async (currentUser: User) => {
    const q = query(collection(db, 'shops'), where('inviteCode', '==', formData.joinCode));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) throw new Error('Invalid or Expired Shop Code');
    const foundShopId = querySnapshot.docs[0].id;
    
    // Link to User Profile
    await setDoc(doc(db, 'users', currentUser.uid), {
      email: currentUser.email,
      shopId: foundShopId,
      role: 'staff',
      createdAt: new Date().toISOString()
    });

    // Smart Merge Logic
    const staffByPhoneQ = query(collection(db, `shops/${foundShopId}/staff`), where('phone', '==', formData.staffPhone || '-'));
    const staffByEmailQ = query(collection(db, `shops/${foundShopId}/staff`), where('email', '==', currentUser.email || ''));
    
    const [phoneSnap, emailSnap] = await Promise.all([getDocs(staffByPhoneQ), getDocs(staffByEmailQ)]);
    const existingDoc = !phoneSnap.empty ? phoneSnap.docs[0] : (!emailSnap.empty ? emailSnap.docs[0] : null);
    
    const timestamp = new Date().toISOString();
    const updatedAt = Date.now();
    let existingData: Record<string, any> = {
      role: 'Sales Associate',
      salary: 0,
      status: 'active',
      joinedAt: timestamp,
      permissions: getRolePermissions('Sales Associate'),
    };

    if (existingDoc) {
      const oldData = existingDoc.data();
      existingData = {
        ...existingData,
        ...oldData,
        permissions: normalizePermissionMatrix(
          oldData.permissions,
          getRolePermissions(String(oldData.role || existingData.role)),
        ),
      };
      if (existingDoc.id !== currentUser.uid) await deleteDoc(doc(db, `shops/${foundShopId}/staff`, existingDoc.id));
    }

    const normalizedPermissions = normalizePermissionMatrix(
      existingData.permissions,
      getRolePermissions(String(existingData.role || 'Sales Associate')),
    );

    const publicStaffData = {
      id: currentUser.uid,
      name: formData.staffName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Staff',
      email: currentUser.email || '',
      phone: formData.staffPhone || '-',
      role: existingData.role,
      joinedAt: existingData.joinedAt || timestamp,
      status: existingData.status || 'active',
      permissions: normalizedPermissions,
      updatedAt,
    };

    await setDoc(doc(db, `shops/${foundShopId}/staff`, currentUser.uid), publicStaffData);
    await setDoc(doc(db, `shops/${foundShopId}/staff_private`, currentUser.uid), {
      id: currentUser.uid,
      salary: Number(existingData.salary || 0),
      updatedAt,
    });
  };

  const handleMasterAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let currentUser = user;
      
      // Phase 1: Authentication
      if (!user) {
        try {
          const credentials = mode === 'login'
            ? await signInWithEmailAndPassword(auth, formData.email, formData.password)
            : await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          currentUser = credentials.user;
        } catch (authErr: unknown) {
          if (authErr instanceof FirebaseError && authErr.code === 'auth/email-already-in-use' && mode !== 'login') {
             throw new Error("Account already exists. Please switch to Sign In.");
          }
          throw authErr; // Caught by outer try/catch
        }
      }

      if (!currentUser) throw new Error('Authentication integrity failed');

      // Phase 2: Quick Shop Discovery (Prevents "Setup Loop")
      const shopsQ = query(collection(db, 'shops'), where('ownerId', '==', currentUser.uid));
      const shopsSnap = await getDocs(shopsQ);
      
      if (!shopsSnap.empty) {
        const recoveredShopId = shopsSnap.docs[0].id;
        console.info("Auth: Found existing shop ownership:", recoveredShopId);
        
        // 1. Link User Profile
        await setDoc(doc(db, 'users', currentUser.uid), { 
          shopId: recoveredShopId, 
          role: 'admin',
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // 2. TRIGGER CLAIMS: Explicitly touch the staff record to trigger onStaffWrite Cloud Function
        await setDoc(doc(db, `shops/${recoveredShopId}/staff`, currentUser.uid), {
          id: currentUser.uid,
          role: 'admin',
          status: 'active',
          updatedAt: Date.now()
        }, { merge: true });
        
        // 3. FORCE REFRESH: Fetch the new claims immediately
        const { forceTokenRefresh } = useAuthStore.getState();
        await forceTokenRefresh();

        // 4. Final jump
        window.location.reload();
        return;
      }

      // Phase 3: Routing Business Logic
      if (mode === 'setup') {
        await provisionNewShop(currentUser);
      } else if (mode === 'join' || (needsShopSetup && formData.joinCode)) {
        await processShopJoin(currentUser);
      }

      window.location.reload();
    } catch (err) {
      setError(getReadableError(err));
    } finally {
      setLoading(false);
    }
  };

  // --- 🎨 5. RENDER METHODS ---
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-primary/30 font-sans">
      {/* Immersive Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Header */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-600 shadow-[0_0_40px_rgba(var(--primary),0.3)] mb-6 group">
            <ShoppingBag className="h-8 w-8 text-white transition-transform duration-500 group-hover:scale-110" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 text-foreground drop-shadow-md">
            Business Hub <span className="text-primary italic">Pro</span>
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.25em]">Intelligent Management</p>
        </div>

        {/* Main Card */}
        <div className="bg-card/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-border/50 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
          
          {/* Mode Selector */}
          <div className="flex bg-accent/50 p-1.5 rounded-2xl mb-8 overflow-hidden border border-border/50">
            {['login', 'join', 'setup'].map((m) => (
              <button 
                key={m}
                onClick={() => setMode(m as AuthMode)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-xl",
                  mode === m 
                    ? "bg-foreground text-background shadow-[0_4px_14px_rgba(var(--foreground),0.1)]" 
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                )}
              >
                {m === 'login' ? 'Sign In' : m === 'join' ? 'Join Team' : 'New Shop'}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-destructive text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {/* Active Form Injection */}
          {mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
              {resetSent ? (
                <div className="p-6 rounded-3xl bg-green-500/10 border border-green-500/20 text-center">
                  <Mail className="h-10 w-10 text-green-500 mx-auto mb-4" />
                  <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-2">Link Dispatched</p>
                  <p className="text-[10px] text-muted-foreground font-bold px-2 leading-relaxed">
                    Check <span className="text-foreground">{formData.email}</span> for secure recovery instructions.
                  </p>
                  <button type="button" onClick={() => { setMode('login'); setResetSent(false); }} className="mt-6 text-[10px] font-black uppercase tracking-widest text-foreground hover:text-primary transition-colors">
                    Return to Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="email" required value={formData.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all font-bold placeholder:text-muted-foreground/30 text-foreground" placeholder="admin@zarra.com" />
                    </div>
                  </div>
                  <button disabled={loading} className="w-full bg-gradient-to-r from-primary to-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-primary/20">
                    {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : 'Transmit Reset Link'}
                  </button>
                  <button type="button" onClick={() => setMode('login')} className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors py-2">
                    Cancel Action
                  </button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleMasterAuthSubmit} className="space-y-5">
              
              {needsShopSetup && (
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Profile Verified</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Finalize your workspace settings below.</p>
                  </div>
                </div>
              )}

              {mode === 'setup' && (
                <div className="space-y-2 group animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Name</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" required value={formData.shopName} onChange={(e) => updateForm('shopName', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold placeholder:text-muted-foreground/30 text-foreground" placeholder="Zarra Operations Hub" />
                  </div>
                </div>
              )}

              {mode === 'join' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Access Token</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="text" required value={formData.joinCode} onChange={(e) => updateForm('joinCode', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-black tracking-[0.2em] placeholder:tracking-normal placeholder:text-muted-foreground/30 text-foreground uppercase" placeholder="Enter Secure Code" />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Legal Name</label>
                    <div className="relative">
                      <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="text" required value={formData.staffName} onChange={(e) => updateForm('staffName', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold placeholder:text-muted-foreground/30 text-foreground" placeholder="John Doe" />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Number</label>
                    <input type="tel" required value={formData.staffPhone} onChange={(e) => updateForm('staffPhone', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold placeholder:text-muted-foreground/30 text-foreground" placeholder="+91 98765 43210" />
                  </div>
                </div>
              )}

              {!user && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Identifier (Email)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="email" required value={formData.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold placeholder:text-muted-foreground/30 text-foreground" placeholder="user@domain.com" />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security Key</label>
                      <button type="button" onClick={() => setMode('forgot')} className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-foreground transition-colors">
                        Lost Access?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="password" required value={formData.password} onChange={(e) => updateForm('password', e.target.value)} className="w-full bg-accent/50 border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold placeholder:text-muted-foreground/30 text-foreground" placeholder="••••••••" />
                    </div>
                  </div>
                </div>
              )}

              <button disabled={loading} className="w-full bg-gradient-to-r from-primary to-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6 shadow-lg shadow-primary/20">
                {loading ? (
                  <Sparkles className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Authenticate Session' : mode === 'join' ? 'Establish Connection' : 'Initialize Workspace'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {!user && (
                <>
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
                    <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                      <span className="bg-card px-4">Federated Auth</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    {!loading ? (
                      <button type="button" onClick={handleGoogleAuth} className="w-full max-w-xs flex items-center justify-center gap-3 py-4 bg-accent/50 border border-border/50 rounded-2xl hover:bg-accent hover:border-border transition-all group">
                        <Globe className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground">Sign in with Google</span>
                      </button>
                    ) : (
                       <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse py-4">Awaiting Verification Gateway...</p>
                    )}
                  </div>
                </>
              )}
              
              {user && (
                <button type="button" onClick={() => auth.signOut()} className="w-full flex items-center justify-center gap-2 py-3 mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-all border border-transparent hover:border-destructive/20 rounded-xl hover:bg-destructive/10">
                  <LogOut className="h-3 w-3" /> Terminate Session
                </button>
              )}
            </form>
          )}
        </div>

        {/* Footer Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-foreground" />
            <span className="text-[10px] font-black uppercase tracking-tighter text-foreground">End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-foreground" />
            <span className="text-[10px] font-black uppercase tracking-tighter text-foreground">Global Sync Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
