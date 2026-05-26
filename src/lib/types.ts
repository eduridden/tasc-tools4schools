

import type { LucideIcon } from "lucide-react";

// Corresponds to the AiTool entity in backend.json
export type AiTool = {
  id: string;
  name: string;
  description?: string;
  url: string;
  logoUrl?: string;
  toolCategoryIds: string[];
  costModel: 'Free' | 'Freemium' | 'Subscription';
  ageRestriction?: 'All Ages' | '13+' | '16+' | '18+';
  status: 'Pending' | 'Approved' | 'Rejected';
  youtubeVideoUrl?: string;
  documentationUrl?: string;
  trainingUrl?: string;
  subjectAreaIds: string[];
  targetAudienceIds: string[];
  recommended?: boolean;
  unsafeDataPractices?: boolean;
  createdForTasc?: boolean;
  screenshotUrls?: string[];
  defaultIdea?: string;
  useCaseDescription?: string;
  vettingNotes?: string;
  keyFeatures?: string[];
  gdprCompliant?: 'Yes' | 'No' | 'Unknown';
  coppaCompliant?: 'Yes' | 'No' | 'Unknown';
  ferpaCompliant?: 'Yes' | 'No' | 'Unknown';
  dataHostingLocation?: string;
  st4sVerified?: 'Yes' | 'No' | 'Unknown';
  createdAt?: { seconds: number, nanoseconds: number };
  updatedAt?: { seconds: number, nanoseconds: number };
};

// Corresponds to the ToolCategory entity
export type ToolCategory = {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
};

// Corresponds to the SubjectArea entity
export type SubjectArea = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

// Corresponds to the TargetAudience entity
export type TargetAudience = {
  id: string;
  name: string;
  color: string;
};


export type IconMap = { [key: string]: LucideIcon };

export type MultiSelectOption = {
  value: string;
  label: string;
};

// Corresponds to the SiteSettings entity.
//
// `logoUrl` is the App Logo (Tools4Schools brand — left column on login,
// header). `orgLogoUrl` is the Organisation Logo (TASC — right column on
// login). Both are admin-uploaded via SiteSettingsManager and persisted as
// Firebase Storage download URLs. When unset, the renderer falls back to
// the static fallback URLs from `src/lib/branding.ts`.
export type SiteSettings = {
  siteName: string;
  siteSubtitle: string;
  allowToolSubmission: boolean;
  allowedDomains?: string[];
  loginDescription?: string;
  logoUrl?: string;
  orgLogoUrl?: string;
  faviconUrl?: string;
  requireLogin?: boolean;
};

export type ToolReview = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  rating: number;
  reviewText: string;
  createdAt?: { seconds: number; nanoseconds: number };
};

// A generic type for taxonomy items (Categories, Subjects) to be used in management components
export type TaxonomyItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
};
