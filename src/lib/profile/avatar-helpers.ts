'use client';

import { createClient } from '@/lib/supabase/client';

// Converts a canvas data URL (base64-encoded) to a Blob for upload.
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// Uploads a cropped avatar (data URL) to Supabase Storage bucket `avatars`.
// File path: {userId}/avatar.png — upsert: true, so re-uploads overwrite.
// Returns the public URL with a cache-buster query param, or null on error.
export async function uploadAvatar(
  userId: string,
  dataUrl: string,
): Promise<{ publicUrl: string | null; error: unknown }> {
  try {
    const supabase = createClient();
    const blob = dataUrlToBlob(dataUrl);
    const path = `${userId}/avatar.png`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      });

    if (uploadError) {
      return { publicUrl: null, error: uploadError };
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = data.publicUrl
      ? `${data.publicUrl}?t=${Date.now()}`
      : null;

    return { publicUrl, error: null };
  } catch (err) {
    return { publicUrl: null, error: err };
  }
}
