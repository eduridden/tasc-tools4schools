import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FirebaseStorage } from 'firebase/storage';

/**
 * Allowed image MIME types for any storage upload (avatars, logos,
 * screenshots). SVG is intentionally excluded — SVGs can carry JavaScript
 * and execute under the storage origin, which is a stored-XSS vector.
 *
 * The map is also used to derive the file extension server-side, so we
 * never trust the client-supplied filename (`file.name.split('.').pop()`
 * was the previous source of an extension-injection vulnerability).
 */
export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — matches storage.rules.

/**
 * Throws an error with a user-facing message if the file is not an allowed
 * image type or exceeds the size cap.
 *
 * Server-side enforcement also exists in `storage.rules` — this client
 * check is purely UX; never rely on it for security.
 */
export function assertSafeImage(file: File): { ext: string } {
  const ext = IMAGE_MIME_TO_EXT[file.type];
  if (!ext) {
    throw new Error(
      'Unsupported image type. Please upload a JPG, PNG, WebP, or GIF file.',
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be 2 MB or smaller.');
  }
  return { ext };
}

/**
 * Uploads a file to Firebase Storage and returns the public download URL.
 *
 * @param storage - Firebase Storage instance
 * @param path - Storage path, e.g. "tools/abc123/logo.png"
 * @param file - File to upload
 * @param onProgress - Optional progress callback (0–100)
 */
export async function uploadFile(
  storage: FirebaseStorage,
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(percent);
        }
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      },
    );
  });
}

/**
 * Generates a unique storage path for a tool asset. Extension is derived
 * from the file's MIME type, NEVER from the user-supplied filename.
 */
export function toolAssetPath(toolId: string, type: 'logo' | 'screenshot', file: File): string {
  const { ext } = assertSafeImage(file);
  if (type === 'logo') {
    return `tools/${toolId}/logo${ext}`;
  }
  const uid = crypto.randomUUID();
  return `tools/${toolId}/screenshots/${uid}${ext}`;
}

/**
 * Generates the storage path for a user's avatar. Extension is derived
 * from the file's MIME type, NEVER from the user-supplied filename.
 */
export function userAvatarPath(userId: string, file: File): string {
  const { ext } = assertSafeImage(file);
  return `users/${userId}/avatar${ext}`;
}

/**
 * Generates the storage path for a site asset.
 *
 *   - `app-logo`  → Tools4Schools brand (used on header + login left column)
 *   - `org-logo`  → TASC organisation brand (used on login right column)
 *   - `favicon`   → browser tab favicon
 *
 * Extension is derived from the file's MIME (NOT from the user-supplied
 * filename) via `assertSafeImage`. The static fallback files
 * `site/AppLogo.png` and `site/OrgLogo.png` live at distinct paths and are
 * never touched by this helper — admin uploads go to `site/app-logo.{ext}`
 * / `site/org-logo.{ext}` so the fallbacks survive.
 */
export function siteAssetPath(
  name: 'app-logo' | 'org-logo' | 'favicon',
  file: File,
): string {
  const { ext } = assertSafeImage(file);
  return `site/${name}${ext}`;
}
