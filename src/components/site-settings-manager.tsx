
import { useState, useEffect, useRef } from "react";
import { useFirebase, useMemoFirebase, useDoc } from "@/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, Type, FileText, Users, Upload, X, Image, Loader2 } from "lucide-react";
import type { SiteSettings } from "@/lib/types";
import { uploadFile, siteAssetPath } from "@/firebase/storage/upload";
import { APP_LOGO_FALLBACK, ORG_LOGO_FALLBACK } from "@/lib/branding";

type LogoKind = 'app-logo' | 'org-logo';

export function SiteSettingsManager() {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving]         = useState(false);
  const [uploadingAppLogo, setUploadingAppLogo] = useState(false);
  const [uploadingOrgLogo, setUploadingOrgLogo] = useState(false);
  const appLogoInputRef = useRef<HTMLInputElement>(null);
  const orgLogoInputRef = useRef<HTMLInputElement>(null);

  const siteSettingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, "site_settings", "global") : null),
    [firestore]
  );

  const { data: settings, isLoading } = useDoc<SiteSettings>(siteSettingsRef);

  const [formData, setFormData] = useState<SiteSettings>({
    siteName: "",
    siteSubtitle: "",
    allowToolSubmission: true,
    loginDescription: "",
    allowedDomains: [],
    logoUrl: "",
    orgLogoUrl: "",
    faviconUrl: "",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        siteName:            settings.siteName || "",
        siteSubtitle:        settings.siteSubtitle || "",
        allowToolSubmission: settings.allowToolSubmission ?? true,
        loginDescription:    settings.loginDescription || "",
        allowedDomains:      settings.allowedDomains || [],
        logoUrl:             settings.logoUrl || "",
        orgLogoUrl:          settings.orgLogoUrl || "",
        faviconUrl:          settings.faviconUrl || "",
      });
    }
  }, [settings]);

  // Shared upload handler. `kind` decides:
  //   - the storage path (`site/app-logo.{ext}` or `site/org-logo.{ext}`)
  //   - which Firestore field gets the new download URL
  //   - which loading state spins
  const handleLogoUpload = async (kind: LogoKind, file: File) => {
    if (!storage) return;
    const setUploading = kind === 'app-logo' ? setUploadingAppLogo : setUploadingOrgLogo;
    const field        = kind === 'app-logo' ? 'logoUrl' : 'orgLogoUrl';
    setUploading(true);
    try {
      // `siteAssetPath` derives the extension from MIME via `assertSafeImage`
      // — guards against extension-spoofing and oversized uploads.
      const path = siteAssetPath(kind, file);
      const url = await uploadFile(storage, path, file);
      setFormData(f => ({ ...f, [field]: url }));
      if (siteSettingsRef) {
        if (settings) await updateDoc(siteSettingsRef, { [field]: url });
        else await setDoc(siteSettingsRef, { ...formData, [field]: url });
      }
      toast({
        title: kind === 'app-logo' ? "App logo uploaded" : "Organisation logo uploaded",
      });
    } catch (e) {
      const description = e instanceof Error ? e.message : "Upload failed.";
      toast({ variant: "destructive", title: "Logo upload failed", description });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async (kind: LogoKind) => {
    const field = kind === 'app-logo' ? 'logoUrl' : 'orgLogoUrl';
    setFormData(f => ({ ...f, [field]: "" }));
    if (siteSettingsRef && settings) await updateDoc(siteSettingsRef, { [field]: "" });
    toast({
      title: kind === 'app-logo' ? "App logo removed" : "Organisation logo removed",
      description: "Reverted to the default fallback logo.",
    });
  };

  const handleSave = async () => {
    if (!firestore || !siteSettingsRef) return;
    setIsSaving(true);
    try {
      if (settings) {
        await updateDoc(siteSettingsRef, { ...formData });
      } else {
        await setDoc(siteSettingsRef, { ...formData });
      }
      toast({ title: "Settings saved", description: "Site settings have been updated successfully." });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ variant: "destructive", title: "Save failed", description: "There was an error saving the settings." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Site Identity ── */}
      <div className="card bg-base-200/50 border border-base-300">
        <div className="card-body gap-5">
          <h2 className="card-title text-base-content gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Site Identity
          </h2>

          <fieldset className="fieldset">
            <legend className="fieldset-legend flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" /> Site Name
            </legend>
            <input
              type="text"
              value={formData.siteName}
              onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
              placeholder="e.g. AI Tools 4 Schools"
              className="input w-full"
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Site Subtitle
            </legend>
            <input
              type="text"
              value={formData.siteSubtitle}
              onChange={(e) => setFormData({ ...formData, siteSubtitle: e.target.value })}
              placeholder="e.g. Empowering the TASC Community with AI"
              className="input w-full"
            />
          </fieldset>
        </div>
      </div>

      {/* ── Branding ── */}
      <div className="card bg-base-200/50 border border-base-300">
        <div className="card-body gap-5">
          <h2 className="card-title text-base-content gap-2">
            <Image className="h-5 w-5 text-primary" />
            Branding
          </h2>

          {/* App Logo (Tools4Schools brand mark) */}
          <div>
            <p className="text-sm font-semibold text-base-content mb-1">App Logo</p>
            <p className="text-xs text-base-content/50 mb-3">
              Tools4Schools brand mark. Shown in the header and on the left column of the login page. PNG, JPG, WebP or GIF; max 2 MB. If none uploaded, the default fallback is used.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-36 h-14 rounded-xl border border-base-300 bg-white flex items-center justify-center overflow-hidden shrink-0 p-2">
                <img
                  src={formData.logoUrl || APP_LOGO_FALLBACK}
                  alt="App logo preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={appLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload('app-logo', file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => appLogoInputRef.current?.click()}
                  disabled={uploadingAppLogo}
                >
                  {uploadingAppLogo
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                    : <><Upload className="h-4 w-4" /> Upload App Logo</>}
                </button>
                {formData.logoUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-error gap-2"
                    onClick={() => handleRemoveLogo('app-logo')}
                  >
                    <X className="h-4 w-4" /> Remove (use default)
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="divider my-0" />

          {/* Organisation Logo (TASC corporate brand) */}
          <div>
            <p className="text-sm font-semibold text-base-content mb-1">Organisation Logo</p>
            <p className="text-xs text-base-content/50 mb-3">
              TASC corporate mark. Shown on the right column of the login page. PNG, JPG, WebP or GIF; max 2 MB. If none uploaded, the default fallback is used.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-36 h-14 rounded-xl border border-base-300 bg-white flex items-center justify-center overflow-hidden shrink-0 p-2">
                <img
                  src={formData.orgLogoUrl || ORG_LOGO_FALLBACK}
                  alt="Organisation logo preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={orgLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload('org-logo', file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => orgLogoInputRef.current?.click()}
                  disabled={uploadingOrgLogo}
                >
                  {uploadingOrgLogo
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                    : <><Upload className="h-4 w-4" /> Upload Organisation Logo</>}
                </button>
                {formData.orgLogoUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-error gap-2"
                    onClick={() => handleRemoveLogo('org-logo')}
                  >
                    <X className="h-4 w-4" /> Remove (use default)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Access Control ── */}
      <div className="card bg-base-200/50 border border-base-300">
        <div className="card-body gap-5">
          <h2 className="card-title text-base-content gap-2">
            <Users className="h-5 w-5 text-primary" />
            Access Control
          </h2>

          <div className="flex items-center justify-between p-4 rounded-xl bg-base-100 border border-base-300">
            <div>
              <p className="font-semibold text-base-content">Allow Public Tool Submission</p>
              <p className="text-sm text-base-content/50 mt-0.5">
                Enable the public form for users to submit new tools for review.
              </p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={formData.allowToolSubmission}
              onChange={(e) => setFormData({ ...formData, allowToolSubmission: e.target.checked })}
            />
          </div>

          <fieldset className="fieldset">
            <legend className="fieldset-legend flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Login Page Description
            </legend>
            <textarea
              value={formData.loginDescription || ""}
              onChange={(e) => setFormData({ ...formData, loginDescription: e.target.value })}
              placeholder="Describe what this site is for — shown on the left panel of the login screen when Force Login is enabled."
              rows={4}
              className="textarea w-full"
            />
            <p className="fieldset-label text-base-content/40">
              Displayed on the login page alongside your logo.
            </p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Allowed Sign-in Domains
            </legend>
            <textarea
              value={formData.allowedDomains?.join("\n")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  allowedDomains: e.target.value
                    .split("\n")
                    .map((d) => d.trim())
                    .filter((d) => d !== ""),
                })
              }
              placeholder={"school.edu.au\nanother.edu.au"}
              rows={4}
              className="textarea w-full font-mono text-sm"
            />
            <p className="fieldset-label text-base-content/40">
              One domain per line. Leave empty to allow all email addresses.
            </p>
          </fieldset>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="btn btn-primary w-full gap-2"
      >
        {isSaving
          ? <><span className="loading loading-spinner loading-sm" /> Saving…</>
          : <><Save className="h-4 w-4" /> Save Settings</>}
      </button>
    </div>
  );
}
