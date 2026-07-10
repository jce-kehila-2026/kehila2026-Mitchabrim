import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Routes where an authenticated session must NOT be auto-terminated.
const PROTECTED_PREFIXES = ["/admin", "/volunteer", "/login", "/forgot-password", "/new-password"];

function isPublicPath(pathname) {
  return !PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * When a logged-in user navigates to the public main website
 * (e.g. /, /public-gallery, /our-work/*), sign them out automatically
 * so they must re-authenticate before entering /admin or /volunteer again.
 */
export default function PublicAutoLogout() {
  const { user, logout, loading } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    if (isPublicPath(pathname)) {
      logout().catch((e) => console.warn("auto logout:", e?.message));
    }
  }, [pathname, user, loading, logout]);

  return null;
}
