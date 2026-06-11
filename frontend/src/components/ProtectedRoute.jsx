import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allow }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--color-text-muted)" }}>
        טוען...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow && !allow.includes(role)) {
    // Send each role to its own area
    const fallback = role === "admin" ? "/admin" : role === "volunteer" ? "/volunteer" : "/login";
    return <Navigate to={fallback} replace />;
  }

  return children;
}
