
"use client";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useUser } from "@/firebase/auth/use-user";
import { useFirebase, useMemoFirebase, useDoc } from "@/firebase";
import {
    initiateSamlSignIn
} from "@/firebase/non-blocking-login";
import { getAdditionalUserInfo } from "firebase/auth";
import { SamlIcon } from "@/components/icons/saml-icon";
import type { SiteSettings } from "@/lib/types";
import { doc } from "firebase/firestore";
import type { AuthError, User } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ORG_LOGO_FALLBACK } from "@/lib/branding";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { toast } = useToast();
    const auth = useAuth();
    const { firestore } = useFirebase();
    const { user, findOrCreateUser } = useUser();
    const [isLoading, setIsLoading] = useState(false);

    const settingsRef = useMemoFirebase(
        () => firestore ? doc(firestore, 'site_settings', 'global') : null,
        [firestore]
    );
    const { data: settings } = useDoc<SiteSettings>(settingsRef);
    // The login modal continues the org-branded right column of LoginGate
    // into the SSO handoff, so it shows the Organisation Logo.
    const logoSrc = settings?.orgLogoUrl || ORG_LOGO_FALLBACK;

    // Effect to close modal if user becomes logged in
    useEffect(() => {
        if (user && isOpen) {
            onClose();
        }
    }, [user, isOpen, onClose]);


    const handleAuthError = (error: AuthError, customMessage?: { title: string, description: string }) => {
        if (customMessage) {
            toast({
                variant: "destructive",
                title: customMessage.title,
                description: customMessage.description,
            });
            return;
        }

        let title = "An error occurred";
        let description = "An unexpected error occurred. Please try again.";

        if (error && error.code) {
            switch (error.code) {
                case "auth/user-not-found":
                case "auth/wrong-password":
                case "auth/invalid-credential":
                    title = "Login Failed";
                    description = "Invalid email or password. Please try again.";
                    break;
                case "auth/email-already-in-use":
                    title = "Sign Up Failed";
                    description =
                        "This email is already registered. Please try logging in.";
                    break;
                case "auth/weak-password":
                    title = "Sign Up Failed";
                    description = "The password is too weak. Please use at least 6 characters.";
                    break;
                case "auth/account-exists-with-different-credential":
                    title = "Authentication Failed";
                    description = "An account with this email already exists using a different sign-in method. Please sign in with your original method.";
                    break;
                case "auth/operation-not-allowed":
                    title = "Sign-In Method Disabled";
                    description = "This sign-in method is not enabled. Please contact an administrator.";
                    break;
                default:
                    console.error("Firebase Auth Error:", error);
                    description = error.message;
            }
        }

        toast({
            variant: "destructive",
            title: title,
            description: description,
        });
    };

    const handleSamlSignIn = async () => {
        if (!auth || !firestore) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Authentication service not available.",
            });
            return;
        }
        setIsLoading(true);
        const providerId = "saml.tasc-aitools4schools";
        try {
            const result = await initiateSamlSignIn(auth, providerId);

            // Extract givenname / surname from SAML assertion attributes
            const additionalInfo = getAdditionalUserInfo(result);
            const profile = (additionalInfo?.profile ?? {}) as Record<string, unknown>;
            const firstName = (profile['givenname'] as string) ?? '';
            const lastName  = (profile['surname']   as string) ?? '';

            // Upsert user in Firestore, always writing latest name from IdP
            await findOrCreateUser(result.user, { firstName, lastName });
        } catch (error: any) {
            if (error.code === 'auth/operation-not-allowed') {
                handleAuthError(error, {
                    title: "SAML Sign-In Error",
                    description: `The SAML provider ID "${providerId}" may not be configured correctly. Please verify the ID in your Firebase Console under Authentication > Sign-in method > SAML.`
                });
            } else if (error.code === 'auth/invalid-credential') {
                handleAuthError(error, {
                    title: "SAML Login Failed",
                    description: "There was an issue validating the credentials from your SAML provider. Please check the provider configuration and try again."
                });
            } else {
                handleAuthError(error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    {/* Visually hidden but read by screen readers — Radix
                        requires both Title and Description on every Dialog. */}
                    <DialogTitle className="sr-only">Sign in</DialogTitle>
                    <DialogDescription className="sr-only">
                        Sign in with your school-provided credentials via single sign-on.
                    </DialogDescription>
                    <div className="flex flex-col items-center mb-4">
                        <img
                            src={logoSrc}
                            alt="Logo"
                            className="object-contain h-12"
                        />
                    </div>
                </DialogHeader>
                <div className="text-center text-muted-foreground text-sm mb-4">
                    Please log in with your School provided credentials.
                </div>

                <div className="flex flex-col space-y-2">
                    <Button variant="outline" className="w-full" onClick={handleSamlSignIn} disabled={isLoading}>
                        <SamlIcon className="mr-2 h-5 w-5" />
                        Sign in with SSO
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
