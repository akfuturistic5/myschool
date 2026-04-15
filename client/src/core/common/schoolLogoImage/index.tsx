import { useEffect, useState, type CSSProperties } from "react";
import ImageWithBasePath from "../imageWithBasePath";
import { getApiBaseUrl, getTenantBearerToken } from "../../services/apiService";
import { img_path } from "../../../environment";

const FALLBACK = `${img_path}assets/img/logo-small.svg`;

function isTenantLogoApiPath(src: string): boolean {
  const s = src.trim();
  return s.includes("/api/school/profile/logo/");
}

async function absoluteUrlForLogoFetch(src: string): Promise<string> {
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/api")) {
    const base = await getApiBaseUrl();
    const origin = base.replace(/\/api\/?$/i, "");
    return origin + (s.startsWith("/") ? s : `/${s}`);
  }
  return s;
}

type Props = {
  src: string;
  className?: string;
  alt?: string;
  style?: CSSProperties;
};

/**
 * Renders school logo: static assets via ImageWithBasePath; uploaded logos (/api/school/profile/logo/...)
 * are fetched with cookies + Bearer (split SPA/API safe). Plain &lt;img src="/api/..."&gt; hits the frontend host → 404.
 */
export default function SchoolLogoImage({ src, className, alt, style }: Props) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!src || !isTenantLogoApiPath(src)) {
      setDisplaySrc(null);
      setPhase("idle");
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPhase("loading");
    setDisplaySrc(null);

    (async () => {
      try {
        const abs = await absoluteUrlForLogoFetch(src);
        const headers: Record<string, string> = {
          Accept: "image/*,*/*",
        };
        const tb = getTenantBearerToken();
        if (tb) {
          headers.Authorization = `Bearer ${tb}`;
        }
        const res = await fetch(abs, {
          method: "GET",
          credentials: "include",
          headers,
          cache: "no-store",
          mode: "cors",
        });
        if (!res.ok) {
          if (!cancelled) setPhase("error");
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setDisplaySrc(objectUrl);
          setPhase("ready");
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!src) {
    return (
      <ImageWithBasePath src="assets/img/logo-small.svg" className={className} alt={alt || "School Logo"} />
    );
  }

  if (isTenantLogoApiPath(src)) {
    if (phase === "error") {
      return (
        <img
          className={className}
          alt={alt || "School Logo"}
          style={style}
          src={FALLBACK}
        />
      );
    }
    if (phase === "ready" && displaySrc) {
      return (
        <img className={className} alt={alt || "School Logo"} style={style} src={displaySrc} />
      );
    }
    return (
      <span
        className={className}
        style={{ ...style, display: "inline-block", minWidth: 32, minHeight: 32, opacity: 0.35 }}
        aria-hidden
        title="Loading logo…"
      />
    );
  }

  return (
    <ImageWithBasePath
      src={src}
      className={className}
      alt={alt || "School Logo"}
      style={style}
    />
  );
}
