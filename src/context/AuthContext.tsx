import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase.ts';
import { UserProfile, UserRole } from '../types/index.ts';

// Bootstrap Admin Emails
const BOOTSTRAP_ADMIN_EMAILS = [
  'rodrigogalvez@42labs.cl',
  'admin@potenciaredes.cl',
];

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateProfile = async (fbUser: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes((fbUser.email || '').toLowerCase());
      const role: UserRole = isBootstrapAdmin ? 'SUPER_ADMIN' : 'CUSTOMER';

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        // Si el correo es de admin bootstrap, mantener permiso
        const finalRole = isBootstrapAdmin ? 'SUPER_ADMIN' : data.role || 'CUSTOMER';
        setProfile({ ...data, role: finalRole });

        // Si es admin, asegurar registro en /admins/{uid}
        if (isBootstrapAdmin) {
          await setDoc(doc(db, 'admins', fbUser.uid), {
            uid: fbUser.uid,
            email: fbUser.email,
            role: 'SUPER_ADMIN',
            grantedAt: new Date().toISOString(),
          }, { merge: true }).catch(() => {});
        }
      } else {
        const newProfile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Cliente',
          photoURL: fbUser.photoURL || undefined,
          role,
          status: 'ACTIVE',
          totalSpent: 0,
          orderCount: 0,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newProfile, { merge: true });
        setProfile(newProfile);

        if (isBootstrapAdmin) {
          await setDoc(doc(db, 'admins', fbUser.uid), {
            uid: fbUser.uid,
            email: fbUser.email,
            role: 'SUPER_ADMIN',
            grantedAt: new Date().toISOString(),
          }, { merge: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error reading or writing user profile:', err);
      // Fallback local profile si firestore está restringido
      const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes((fbUser.email || '').toLowerCase());
      setProfile({
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Usuario',
        role: isBootstrapAdmin ? 'SUPER_ADMIN' : 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        await fetchOrCreateProfile(fbUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await fetchOrCreateProfile(res.user);
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      await fetchOrCreateProfile(res.user);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    if (res.user) {
      if (name) {
        await updateProfile(res.user, { displayName: name });
      }
      await fetchOrCreateProfile(res.user);
    }
  };

  const logout = async () => {
    await fbSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchOrCreateProfile(user);
    }
  };

  const currentRole = profile?.role || (BOOTSTRAP_ADMIN_EMAILS.includes((user?.email || '').toLowerCase()) ? 'SUPER_ADMIN' : 'CUSTOMER');
  const isAdmin = currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: currentRole,
        isAdmin,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
