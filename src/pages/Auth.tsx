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
  signInWithPopup 
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '@/lib/useAuthStore';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const { user, shopId } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'setup' | 'join'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is logged in but has no shop context, force setup
  const needsShopSetup = user && !shopId;

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
          // Smart Logic: If they tried to sign up/join but account exists, just log them in!
          if (authErr.code === 'auth/email-already-in-use') {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            currentUser = userCredential.user;
          } else {
            throw authErr;
          }
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
        await setDoc(doc(db, 'users', currentUser.uid), {
          email: currentUser.email,
          shopId: foundShopId,
          role: 'staff',
          createdAt: new Date().toISOString()
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
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        shopId: foundShopId,
        role: 'staff',
        createdAt: new Date().toISOString()
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Security Key</label>
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
