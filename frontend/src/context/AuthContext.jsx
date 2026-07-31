import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { resolveUserAccess } from "../services/allowedUsersService";
import { logout as doLogout } from "../services/authService";

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      const res = await resolveUserAccess({ uid: fbUser.uid, email: fbUser.email });
      if (res.success && res.user.active) {
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: res.user.displayName || "",
        });
        setRole(res.user.role);
      } else {
        // Not allowed: sign them out
        await doLogout();
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await doLogout();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
