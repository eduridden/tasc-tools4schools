
'use client';

import { useFirebase } from "@/firebase/provider";
import type { User } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { safeUrl } from '@/lib/url';

export interface SamlProfile {
  firstName?: string;
  lastName?: string;
}

export interface UserDoc {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface UserWithAdmin {
    user: User | null;
    userDoc: UserDoc | null;
    isAdmin: boolean;
    isUserLoading: boolean;
    userError: Error | null;
    findOrCreateUser: (user: User, samlProfile?: SamlProfile) => Promise<void>;
}

export const useUser = (): UserWithAdmin => {
  const { auth, firestore } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to the Firestore user doc whenever the auth user changes
  useEffect(() => {
    if (!firestore || !user) {
      setUserDoc(null);
      return;
    }
    const unsub = onSnapshot(
      doc(firestore, 'users', user.uid),
      snap => setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null),
      _err => setUserDoc(null),
    );
    return unsub;
  }, [firestore, user]);

  const findOrCreateUser = async (user: User, samlProfile?: SamlProfile) => {
    if (!firestore || !user.email) return;

    const firstName = samlProfile?.firstName ?? '';
    const lastName  = samlProfile?.lastName ?? '';
    const displayName = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || user.displayName || user.email.split('@')[0];

    // Validate the IdP-supplied photo URL before it ever lands in Firestore
    // or the Firebase Auth profile. SAML photo URLs are attacker-influenced
    // in the sense that a compromised IdP claim could carry a `javascript:`
    // or `data:` URI; safeUrl forces http(s) only.
    const photoURL = safeUrl(user.photoURL ?? '');

    // Sync name into Firebase Auth so user.displayName is always current.
    // Surface failures rather than swallowing them — silent IdP-sync
    // failures hide a broken trust path.
    if (auth && displayName && user.displayName !== displayName) {
      try {
        await updateProfile(user, { displayName });
      } catch (err) {
        console.error('updateProfile (displayName) failed:', err);
      }
    }

    const userDocRef = doc(firestore, 'users', user.uid);

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('email', '==', user.email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // First login — create the document. NEVER include `role` here:
      // the authoritative admin signal is the Firebase Auth custom claim
      // (`request.auth.token.role`), not a Firestore field. Firestore rules
      // forbid the client from writing `role`.
      await setDoc(userDocRef, {
        email:       user.email,
        displayName,
        firstName,
        lastName,
        photoURL,
      });
    } else {
      // Subsequent logins — refresh profile fields from the IdP only.
      await updateDoc(userDocRef, {
        email:       user.email,
        displayName,
        firstName,
        lastName,
        photoURL,
      });
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult();
            const userIsAdmin = idTokenResult.claims.role === 'admin';
            setIsAdmin(userIsAdmin);
          } catch (e) {
            console.error("Error getting user claims:", e);
            setIsAdmin(false);
            setError(e as Error);
          }
        } else {
          setUser(null);
          setIsAdmin(false);
        }
        setIsLoading(false);
      },
      (e) => {
        console.error("onAuthStateChanged error:", e);
        setError(e);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return {
    user,
    userDoc,
    isUserLoading: isLoading,
    userError: error,
    isAdmin,
    findOrCreateUser,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = () => {
  const { auth } = useFirebase();
  return auth;
};
