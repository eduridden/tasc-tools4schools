
'use client';

import { Link } from "react-router-dom";
import { useState } from "react";
import { useUser } from "@/firebase/auth/use-user";
import { useAuth } from "@/firebase/auth/use-user";
import { useFirebase, useMemoFirebase, useDoc } from "@/firebase";
import { doc } from 'firebase/firestore';
import type { SiteSettings, ToolCategory, SubjectArea, TargetAudience } from "@/lib/types";
import { LogOut, Shield, PlusCircle, LogIn, Menu, Settings } from "lucide-react";
import { SubmitToolModal } from "./submit-tool-modal";
import { useCollection } from "@/firebase";
import { collection } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { APP_LOGO_FALLBACK } from "@/lib/branding";


export function Header({ onLoginClick }: { onLoginClick: () => void }) {
  const auth = useAuth();
  const { user, userDoc, isUserLoading, isAdmin } = useUser();
  const { firestore } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'site_settings', 'global') : null, [firestore]);
  const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, "tool_categories") : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? collection(firestore, "subject_areas") : null, [firestore]);
  const audiencesQuery = useMemoFirebase(() => firestore ? collection(firestore, "target_audiences") : null, [firestore]);

  const { data: settings, isLoading: loadingSettings } = useDoc<SiteSettings>(settingsRef);
  const { data: categories, isLoading: loadingCategories } = useCollection<ToolCategory>(categoriesQuery);
  const { data: subjects, isLoading: loadingSubjects } = useCollection<SubjectArea>(subjectsQuery);
  const { data: audiences, isLoading: loadingAudiences } = useCollection<TargetAudience>(audiencesQuery);

  const isLoading = loadingSettings || loadingCategories || loadingSubjects || loadingAudiences;
  const allowSubmission = settings?.allowToolSubmission ?? true;

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  const displayName = userDoc?.displayName || user?.displayName || user?.email;
  const avatarUrl   = userDoc?.avatarUrl  || user?.photoURL    || '';
  const siteName    = settings?.siteName    || 'AI Tools 4 Schools';
  const siteSubtitle = settings?.siteSubtitle || 'Empowering the TASC Community with powerful and safe AI tools';
  const logoSrc     = settings?.logoUrl || APP_LOGO_FALLBACK;

  return (
    <>
      <header className="bg-base-100 shadow-sm sticky top-0 z-50 border-b border-base-200">
      <div className="navbar container mx-auto px-4">

        {/* ── Left side ── */}
        <div className="navbar-start gap-3">

          {/* Mobile hamburger menu */}
          <div className="dropdown lg:hidden">
            <button tabIndex={0} className="btn btn-ghost btn-square" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <ul tabIndex={-1} className="menu menu-sm dropdown-content bg-base-100 rounded-box shadow-lg z-10 mt-3 w-56 p-2 gap-0.5">
              {user && auth && allowSubmission && (
                <li>
                  <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-success" />
                    Submit a tool
                  </button>
                </li>
              )}
              {isAdmin && (
                <li>
                  <Link to="/admin" className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-warning" />
                    Admin Panel
                  </Link>
                </li>
              )}
              {user && auth ? (
                <>
                  <li>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </li>
                  <li>
                    <button onClick={() => auth.signOut()} className="flex items-center gap-2 text-error">
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <button onClick={onLoginClick} className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Log in
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Logo */}
          <Link to="/" className="shrink-0 transition-transform hover:scale-105">
            <img
              src={logoSrc}
              alt={siteName}
              className="w-[140px] h-auto object-contain"
            />
          </Link>

          {/* Divider + site title — hidden on mobile */}
          <div className="hidden sm:block w-px h-8 bg-base-300" />
          <div className="hidden md:flex flex-col">
            {loadingSettings ? (
              <>
                <div className="skeleton h-5 w-40" />
                <div className="skeleton h-3 w-56 mt-1" />
              </>
            ) : (
              <>
                <h1 className="text-lg font-extrabold font-headline text-primary tracking-tight leading-none">
                  {siteName}
                </h1>
                <p className="text-base-content/50 text-xs mt-0.5 font-medium">
                  {siteSubtitle}
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Right side ── */}
        <div className="navbar-end gap-2">
          {isUserLoading ? (
            <div className="skeleton h-10 w-32 rounded-full" />
          ) : user && auth ? (
            <>
              {/* Submit button — desktop only */}
              {allowSubmission && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="btn btn-success btn-sm hidden sm:flex gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  Submit a tool
                </button>
              )}

              {/* User avatar dropdown */}
              <div className="dropdown dropdown-end">
                <button
                  tabIndex={0}
                  className="btn btn-ghost btn-circle"
                  aria-label="Account menu"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full ring-2 ring-offset-1 ring-offset-base-100 overflow-hidden flex items-center justify-center bg-base-200",
                    isAdmin ? "ring-warning" : "ring-base-300"
                  )}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName || ""} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-base-content">
                        {getInitials(displayName)}
                      </span>
                    )}
                  </div>
                </button>
                <ul tabIndex={-1} className="menu menu-sm dropdown-content bg-base-100 rounded-box shadow-xl z-10 mt-2 w-60 p-2 gap-0.5">
                  <li className="menu-title px-3 py-2">
                    <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">My Account</span>
                    <span className="text-sm font-medium text-base-content truncate">{displayName}</span>
                  </li>
                  <div className="divider my-0.5" />
                  {isAdmin && (
                    <li>
                      <Link to="/admin" className="flex items-center gap-2 text-warning">
                        <Shield className="h-4 w-4" />
                        Admin Panel
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={() => auth.signOut()}
                      className="flex items-center gap-2 text-error"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className="btn btn-primary btn-sm rounded-full px-5 gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              Log In
            </button>
          )}
        </div>
      </div>
      </header>

      <SubmitToolModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        allCategories={categories || []}
        allSubjects={subjects || []}
        allAudiences={audiences || []}
        isLoading={isLoading}
      />
    </>
  );
}
