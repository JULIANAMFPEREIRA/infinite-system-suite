import { supabase } from "@/integrations/supabase/client";

const STORAGE_RE = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/;

export function parseStorageUrl(url?: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  const m = url.match(STORAGE_RE);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

const cache = new Map<string, { url: string; exp: number }>();

/** Resolves a stored storage URL (public or signed) into a fresh signed URL. */
export async function resolveStorageUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;
  const key = `${parsed.bucket}/${parsed.path}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 3600);
  if (error || !data?.signedUrl) return null;
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
