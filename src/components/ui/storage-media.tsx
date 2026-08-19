import { useEffect, useState } from "react";
import { resolveStorageUrl } from "@/lib/storageUrl";

/** Resolves a stored file URL into a short-lived signed URL. */
export function useSignedUrl(url?: string | null) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setResolved(null);
    resolveStorageUrl(url).then(u => { if (active) setResolved(u); });
    return () => { active = false; };
  }, [url]);
  return resolved;
}

type ImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { url?: string | null };

export function StorageImage({ url, ...rest }: ImgProps) {
  const signed = useSignedUrl(url);
  if (!signed) return <div className={rest.className} aria-hidden />;
  return <img src={signed} {...rest} />;
}

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { url?: string | null };

export function StorageLink({ url, children, ...rest }: LinkProps) {
  const signed = useSignedUrl(url);
  return (
    <a href={signed ?? undefined} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
