/**
 * Logo URL for header + sidebar: prefer master_db-backed value from session (`school_logo`),
 * else same fallbacks previously used when logos were hardcoded by school name.
 */
export function getSchoolLogoSrc(user: {
  school_logo?: string | null;
  school_name?: string | null;
} | null): string {
  const fromMaster = (user?.school_logo ?? "").toString().trim();
  if (fromMaster) return fromMaster;
  const name = (user?.school_name || "").toString().trim().toLowerCase();
  if (name.includes("millat")) return "assets/img/icons/millat-logo.png";
  if (name.includes("iqra")) return "assets/img/icons/iqra-logo.bmp";
  return "assets/img/logo-small.svg";
}

export function isMillatStyleLogoPath(src: string): boolean {
  return (src || "").includes("millat-logo");
}
