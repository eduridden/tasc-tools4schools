import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { Header } from '@/components/header';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Loader2, User, Save } from 'lucide-react';
import { LoginModal } from '@/components/login-modal';
import { uploadFile, userAvatarPath } from '@/firebase/storage/upload';
import { safeImageUrl } from '@/lib/url';

export default function UserSettingsPage() {
  const navigate = useNavigate();
  const { firestore, storage } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [bio, setBio]                       = useState('');
  const [avatarUrl, setAvatarUrl]           = useState('');
  const [isSaving, setIsSaving]             = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen]   = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Load current user doc fields
  useEffect(() => {
    if (!user || !firestore) return;
    import('firebase/firestore').then(({ getDoc, doc: fsDoc }) => {
      getDoc(fsDoc(firestore, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setBio(data.bio || '');
          setAvatarUrl(data.avatarUrl || user.photoURL || '');
        } else {
          setAvatarUrl(user.photoURL || '');
        }
      });
    });
  }, [user, firestore]);

  const handleAvatarUpload = async (file: File) => {
    if (!storage || !user || !firestore) return;
    setIsUploadingAvatar(true);
    try {
      // userAvatarPath rejects non-image MIME types and oversized files —
      // SVG is intentionally NOT accepted (stored-XSS via storage origin).
      const path = userAvatarPath(user.uid, file);
      const url = await uploadFile(storage, path, file);
      setAvatarUrl(url);
      await updateDoc(doc(firestore, 'users', user.uid), { avatarUrl: url });
      toast({ title: 'Avatar updated' });
    } catch (e) {
      const description = e instanceof Error ? e.message : 'Upload failed.';
      toast({ variant: 'destructive', title: 'Upload failed', description });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), { bio: bio.trim() });
      toast({ title: 'Settings saved' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <Header onLoginClick={() => setIsLoginModalOpen(true)} />
        <div className="flex flex-1 items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <Header onLoginClick={() => setIsLoginModalOpen(true)} />
        <div className="flex flex-1 items-center justify-center flex-col gap-4">
          <p className="text-base-content/60">You must be logged in to view settings.</p>
          <button className="btn btn-primary" onClick={() => setIsLoginModalOpen(true)}>Log In</button>
        </div>
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      </div>
    );
  }

  const displayName = user.displayName || user.email || 'Unknown User';

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />

      <main className="flex-1 container py-8 max-w-2xl">

        {/* Back */}
        <button
          className="btn btn-ghost btn-sm gap-2 mb-6"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-base-content mb-6 flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          My Settings
        </h1>

        <div className="space-y-6">

          {/* Avatar + Name */}
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body gap-6">
              <h2 className="card-title text-base">Profile</h2>

              {/* Avatar */}
              <div className="flex items-center gap-6">
                {/* Preview */}
                <div className="w-24 h-24 rounded-full border-2 border-base-300 bg-base-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                  {safeImageUrl(avatarUrl) ? (
                    <img src={safeImageUrl(avatarUrl)} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-base-content/40">
                      {getInitials(displayName)}
                    </span>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-base-content">Profile Photo</p>
                  <p className="text-xs text-base-content/50">JPG, PNG, WebP or GIF. Visible to other logged-in users.</p>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-2 self-start"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                      : <><Upload className="h-4 w-4" /> Upload Photo</>}
                  </button>
                </div>
              </div>

              {/* Name — read only */}
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text font-medium">Display Name</span>
                  <span className="label-text-alt text-base-content/40">Set by your school — cannot be changed here</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  readOnly
                  className="input input-bordered bg-base-200 cursor-not-allowed text-base-content/60"
                />
              </div>

              {/* Email — read only */}
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text font-medium">Email</span>
                </label>
                <input
                  type="text"
                  value={user.email || ''}
                  readOnly
                  className="input input-bordered bg-base-200 cursor-not-allowed text-base-content/60"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body gap-4">
              <h2 className="card-title text-base">About Me</h2>
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text font-medium">Bio</span>
                  <span className="label-text-alt text-base-content/40">{bio.length}/300</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full resize-none leading-relaxed"
                  rows={4}
                  maxLength={300}
                  placeholder="Tell other teachers a bit about yourself — your role, year level, subjects, or interests…"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary w-full gap-2"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving
              ? <><span className="loading loading-spinner loading-sm" /> Saving…</>
              : <><Save className="h-4 w-4" /> Save Settings</>}
          </button>
        </div>
      </main>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
