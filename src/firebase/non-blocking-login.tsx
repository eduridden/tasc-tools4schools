
'use client';
import {
  Auth, // Import Auth type for type hinting
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  SAMLAuthProvider,
  type UserCredential,
  type AuthError
} from 'firebase/auth';


/** Initiate email/password sign-in (non-blocking). */
export async function initiatePasswordSignIn(auth: Auth, email: string, password: string): Promise<UserCredential> {
  try {
    // First, try to sign in.
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    // If sign-in fails because the user is not found, create a new account.
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        return await createUserWithEmailAndPassword(auth, email, password);
      } catch (createError: any) {
        // If account creation also fails, throw that error.
        throw createError;
      }
    }
    // If the error was something else (e.g., wrong password), re-throw the original error.
    throw error;
  }
}


/** Initiate SAML sign-in (non-blocking). */
export async function initiateSamlSignIn(auth: Auth, providerId: string): Promise<UserCredential> {
  const provider = new SAMLAuthProvider(providerId);
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error: any) {
    console.error('SAML Sign-In Error:', error);
    throw error;
  }
}
