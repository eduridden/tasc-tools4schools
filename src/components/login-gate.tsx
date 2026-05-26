import { useState } from 'react';
import { useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { doc } from 'firebase/firestore';
import type { SiteSettings } from '@/lib/types';
import { LoginModal } from '@/components/login-modal';
import { SamlIcon } from '@/components/icons/saml-icon';
import { APP_LOGO_FALLBACK, ORG_LOGO_FALLBACK } from '@/lib/branding';

interface LoginGateProps {
  children: React.ReactNode;
}

export function LoginGate({ children }: LoginGateProps) {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Settings are only needed for the login page visuals — not for the gate decision.
  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'site_settings', 'global') : null),
    [firestore]
  );
  const { data: settings } = useDoc<SiteSettings>(settingsRef);

  // While auth state is resolving, show a neutral loading screen.
  // Never render children before we know the user is authenticated.
  if (isUserLoading) {
    return (
      <div className="min-h-screen animate-gradient-hero flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-white/60" />
      </div>
    );
  }

  // User is authenticated — render the app normally.
  if (user) {
    return <>{children}</>;
  }

  // Not logged in — show the login page.
  const siteName    = settings?.siteName        || 'AI Tools 4 Schools';
  const loginDesc   = settings?.loginDescription || '';
  // Admin-uploaded logos take priority; fall back to the static files
  // in `site/AppLogo.png` and `site/OrgLogo.png` maintained out-of-band.
  const appLogoSrc  = settings?.logoUrl    || APP_LOGO_FALLBACK;
  const orgLogoSrc  = settings?.orgLogoUrl || ORG_LOGO_FALLBACK;

  return (
    <div className="min-h-screen animate-gradient-hero flex items-center justify-center p-4">

      {/* Floating cubes background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="floating-cube"
            style={{
              left:              `${8 + i * 12}%`,
              width:             `${20 + (i % 3) * 15}px`,
              height:            `${20 + (i % 3) * 15}px`,
              animationDuration: `${10 + i * 3}s`,
              animationDelay:    `${i * 1.5}s`,
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-4xl">
        <div className="card bg-base-100/95 backdrop-blur-sm shadow-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">

            {/* ── Left column: app logo + site branding + description ── */}
            <div className="flex flex-col justify-between p-8 md:p-10 bg-base-200/60 border-b md:border-b-0 md:border-r border-base-300">
              <div className="flex flex-col gap-6">
                <img
                  src={appLogoSrc}
                  alt={siteName}
                  className="h-14 object-contain self-start"
                />

                <h1 className="text-2xl font-extrabold font-headline text-primary tracking-tight leading-tight">
                  {siteName}
                </h1>

                {loginDesc && (
                  <p className="text-base-content/70 text-sm leading-relaxed whitespace-pre-wrap">
                    {loginDesc}
                  </p>
                )}
              </div>

              <div className="mt-8 hidden md:block">
                <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-secondary opacity-40" />
              </div>
            </div>

            {/* ── Right column: organisation logo + login ── */}
            <div className="flex flex-col items-center justify-center gap-8 p-8 md:p-10">
              <img
                src={orgLogoSrc}
                alt="Organisation"
                className="h-16 object-contain"
              />

              <div className="text-center space-y-2">
                <p className="font-semibold text-base-content">Welcome</p>
                <p className="text-sm text-base-content/55">
                  Sign in with your school-provided credentials to access the tool directory.
                </p>
              </div>

              <button
                className="btn btn-primary w-full gap-2 shadow-md"
                onClick={() => setIsLoginModalOpen(true)}
              >
                <SamlIcon className="h-5 w-5" />
                Sign in with SSO
              </button>

              <p className="text-xs text-base-content/35 text-center">
                Access is restricted to authorised users only.
              </p>
            </div>

          </div>
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
