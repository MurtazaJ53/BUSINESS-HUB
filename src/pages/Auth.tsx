import React, { useState } from 'react';
import { 
  LogIn, 
  Mail, 
  Lock, 
  Store, 
  ArrowRight, 
  UserPlus, 
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  LogOut,
  Globe
} from 'lucide-react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  sendPasswordResetEmail,
  signInAnonymously,
  fetchSignInMethodsForEmail,
  linkWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '@/lib/useAuthStore';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const { user, shopId, role } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'setup' | 'join' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // If user is logged in but has no shop context, force setup
  const needsShopSetup = user && !shopId;

  // Auto-detect invite code from URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setMode('join');
      setJoinCode(invite);
    }
  }, []);

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // If the email is already in use by password, Firebase might error if "One account per email" is on.
      // But standard signInWithPopup handles linking or errors based on console settings.
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousAuth = async () => {
    setError('');
    setLoading(true);
    try {
      await signInAnonymously(auth);
      // Anonymous users start with no shop context
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let currentUser = user;
      
      // 1. Authenticate if not already logged in
      if (!user) {
        try {
          const userCredential = mode === 'login'
            ? await signInWithEmailAndPassword(auth, email, password)
            : await createUserWithEmailAndPassword(auth, email, password);
          currentUser = userCredential.user;
        } catch (authErr: any) {
          // STRICT RULE: If email already in use, don't auto-login unless it's a known provider error.
          // The previous "Smart Logic" could create confusion.
          if (authErr.code === 'auth/email-already-in-use' && mode !== 'login') {
             setError("An account with this email already exists. Please Sign In instead.");
             setLoading(false);
             return;
          }
          throw authErr;
        }
      }

      if (!currentUser) throw new Error('Authentication failed');

      // 2. Handle Shop Logic
      if (mode === 'setup') {
        const newShopId = `shop-${Date.now()}`;
        await setDoc(doc(db, 'shops', newShopId), {
          name: shopName || 'My Business Hub',
          ownerId: currentUser.uid,
          createdAt: new Date().toISOString(),
          settings: { currency: 'INR' },
          shopId: newShopId
        });

        await setDoc(doc(db, 'users', currentUser.uid), {
          email: currentUser.email,
          shopId: newShopId,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      } else if (mode === 'join' || (needsShopSetup && joinCode)) {
        const q = query(collection(db, 'shops'), where('inviteCode', '==', joinCode));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('Invalid or Expired Shop Code');
        }

        const foundShopId = querySnapshot.docs[0].id;
        
        // 1. Link to User Profile
        await setDoc(doc(db, 'users', currentUser.uid), {
          email: currentUser.email,
          shopId: foundShopId,
          role: 'staff',
          createdAt: new Date().toISOString()
        });

        // 2. SMART MERGE: Check for existing placeholder record by phone or email
        const staffByPhoneQuery = query(collection(db, `shops/${foundShopId}/staff`), where('phone', '==', staffPhone || '-'));
        const staffByEmailQuery = query(collection(db, `shops/${foundShopId}/staff`), where('email', '==', currentUser.email || ''));
        
        const [phoneSnapshot, emailSnapshot] = await Promise.all([
          getDocs(staffByPhoneQuery),
          getDocs(staffByEmailQuery)
        ]);

        let existingDoc = !phoneSnapshot.empty ? phoneSnapshot.docs[0] : (!emailSnapshot.empty ? emailSnapshot.docs[0] : null);
        
        let existingData = {
          role: 'Sales',
          salary: 0,
          permissions: ['dashboard', 'inventory', 'sell', 'customers', 'history']
        };

        if (existingDoc) {
          const oldData = existingDoc.data();
          existingData = {
            role: oldData.role || 'Sales',
            salary: oldData.salary || 0,
            permissions: oldData.permissions || existingData.permissions
          };
          // Purge the old placeholder IF it's a different UID to merge into the new verified UID
          if (existingDoc.id !== currentUser.uid) {
            await deleteDoc(doc(db, `shops/${foundShopId}/staff`, existingDoc.id));
          }
        }

        // 3. Create/Update Permanent Staff Record
        const { salary, ...publicStaffData } = {
          id: currentUser.uid,
          name: staffName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Staff',
          email: currentUser.email || '',
          phone: staffPhone || '-',
          role: existingData.role,
          salary: existingData.salary,
          joinedAt: new Date().toISOString(),
          status: 'active',
          permissions: existingData.permissions
        };

        await setDoc(doc(db, `shops/${foundShopId}/staff`, currentUser.uid), publicStaffData);
        
        // 4. Secure Private Data
        await setDoc(doc(db, `shops/${foundShopId}/staff_private`, currentUser.uid), {
          id: currentUser.uid,
          salary: existingData.salary
        });
      }

      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinShop = async () => {
    if (!joinCode || !user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'shops'), where('inviteCode', '==', joinCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Invalid Shop Code');
        setLoading(false);
        return;
      }

      const foundShopId = querySnapshot.docs[0].id;
      
      // 2. SMART MERGE: Check for existing placeholder record
      const staffQuery = query(collection(db, `shops/${foundShopId}/staff`), where('phone', '==', staffPhone || '-'));
      const staffSnapshot = await getDocs(staffQuery);
      let existingData = {
        role: 'Sales',
        salary: 0,
        permissions: ['dashboard', 'inventory', 'sell', 'customers', 'history']
      };

      if (!staffSnapshot.empty) {
        const oldDoc = staffSnapshot.docs[0];
        const oldData = oldDoc.data();
        existingData = {
          role: oldData.role || 'Sales',
          salary: oldData.salary || 0,
          permissions: oldData.permissions || existingData.permissions
        };
        // Purge the placeholder to prevent duplicates
        if (oldDoc.id !== user.uid) {
          await deleteDoc(doc(db, `shops/${foundShopId}/staff`, oldDoc.id));
        }
      }

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        shopId: foundShopId,
        createdAt: new Date().toISOString()
      });

      // 3. Create/Update Permanent Staff Record
      const { salary, ...publicStaffData } = {
        id: user.uid,
        name: staffName || user.displayName || user.email?.split('@')[0] || 'Staff',
        phone: staffPhone || '-',
        role: existingData.role,
        salary: existingData.salary,
        joinedAt: new Date().toISOString(),
        status: 'active',
        permissions: existingData.permissions
      };

      await setDoc(doc(db, `shops/${foundShopId}/staff`, user.uid), publicStaffData);

      // 4. Secure Private Data
      await setDoc(doc(db, `shops/${foundShopId}/staff_private`, user.uid), {
        id: user.uid,
        salary: existingData.salary
      });

      window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 selection:bg-primary/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-600 shadow-2xl shadow-primary/20 mb-6 group">
            <ShoppingBag className="h-8 w-8 text-white transition-transform group-hover:scale-110" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Business Hub <span className="text-primary italic">Pro</span>
          </h1>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-[0.2em]">Next-Gen Shop Management</p>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 border border-white/5 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
          <div className="flex bg-white/5 p-1 rounded-2xl mb-8 overflow-hidden">
            <button 
              onClick={() => setMode('login')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                mode === 'login' ? "bg-white text-black rounded-xl shadow-lg" : "text-zinc-500 hover:text-white"
              )}
            >
              Sign In
            </button>
            <button 
              onClick={() => setMode('join')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                mode === 'join' ? "bg-white text-black rounded-xl shadow-lg" : "text-zinc-500 hover:text-white"
              )}
            >
              Join Team
            </button>
            <button 
              onClick={() => setMode('setup')}
              className={cn(
                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                mode === 'setup' ? "bg-white text-black rounded-xl shadow-lg" : "text-zinc-500 hover:text-white"
              )}
            >
              New Shop
            </button>
          </div>

          {mode === 'forgot' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-center">
                <h3 className="text-lg font-black mb-2">Recover Access</h3>
                <p className="text-xs text-zinc-500 font-bold">We'll send a high-security reset link to your inbox.</p>
              </div>
              
              {resetSent ? (
                <div className="p-6 rounded-3xl bg-green-500/10 border border-green-500/20 text-center animate-in zoom-in">
                  <Mail className="h-10 w-10 text-green-500 mx-auto mb-4" />
                  <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-1">Transmission Successful!</p>
                  <p className="text-[10px] text-zinc-400 font-bold leading-relaxed px-4">
                    If an account exists for <span className="text-white">{email}</span>, a reset link has been dispatched. 
                    Please check your inbox and spam folder.
                  </p>
                  <button 
                    onClick={() => { setMode('login'); setResetSent(false); }}
                    className="mt-6 text-[10px] font-black uppercase tracking-widest text-white hover:text-primary transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                   <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Registered Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  
                  {error && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
                      {error}
                    </div>
                  )}

                  <button
                    disabled={loading}
                    className="w-full premium-gradient text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : 'Send Reset Link'}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => setMode('login')}
                    className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors py-2"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-5">
            {needsShopSetup && (
               <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-1">
                    <Sparkles className="h-3 w-3" /> Account Active
                  </p>
                  <p className="text-[11px] text-zinc-400 font-medium">Please finalize your shop setup below.</p>
               </div>
            )}

            {mode === 'setup' && (
              <div className="space-y-2 group">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Business Name</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                    placeholder="e.g. My Elite Mart"
                  />
                </div>
              </div>
            )}

            {mode === 'join' && (
              <div className="space-y-2 group">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Team Invite Code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-black tracking-[0.2em] placeholder:tracking-normal"
                    placeholder="Code from Admin"
                  />
                </div>
              </div>
            )}

            {mode === 'join' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2 group">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Your Full Name</label>
                  <div className="relative">
                    <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                  <div className="space-y-2 group col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
              </div>
            )}

            {!user && (
              <>
                <div className="space-y-2 group">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Work Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                 <div className="space-y-2 group">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Security Key</label>
                    <button 
                      type="button" 
                      onClick={() => setMode('forgot')}
                      className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-shake">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full premium-gradient text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <Sparkles className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Enter Dashboard' : mode === 'join' ? 'Connect to Team' : 'Initialize Shop'}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            {!user && mode !== 'setup' && (
              <>
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 bg-[#050505] px-4">Instant Entry</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    className="flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-[1.2rem] hover:bg-white/10 transition-all group"
                  >
                    <Globe className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Google</span>
                  </button>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleAnonymousAuth}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-[1.2rem] hover:bg-white/10 transition-all group"
                    >
                      <LogIn className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Guest</span>
                    </button>
                    <p className="text-[8px] text-center text-red-500/60 font-black uppercase tracking-tighter leading-tight">
                      ⚠️ CRITICAL: Guest sessions are non-persistent. <br/>
                      Data will be PERMANENTLY ERASED if you log out or clear browser cache without linking to Google/Email.
                    </p>
                  </div>
                </div>
              </>
            )}
            
            {user && (
              <button 
                type="button"
                onClick={() => auth.signOut()}
                className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20 rounded-xl hover:bg-red-500/5"
              >
                <LogOut className="h-3 w-3" />
                Logout and Switch Account
              </button>
            )}
          </form>
        )}
      </div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Bank-Grade Security</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Cloud Sync Active</span>
          </div>
        </div>
      </div>
    </div>

  );
}
