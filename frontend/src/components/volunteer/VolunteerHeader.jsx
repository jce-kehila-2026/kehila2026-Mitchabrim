import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeVolunteerNotifications,
  markVolunteerNotificationRead,
} from "@/services/volunteerNotificationsService";

const LINKS = [
  { to: "/volunteer", label: "אזור אישי", end: true },
  { to: "/volunteer/report/new", label: "הגשת דוח" },
  { to: "/volunteer/reports", label: "הדוחות שלי" },
  { to: "/volunteer/tasks", label: "המשימות שלי" },
  { to: "/volunteer/profile", label: "הפרטים שלי" },
];

export default function VolunteerHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.email || "מתנדב";
  const initial = (displayName || "מ").trim().charAt(0);

  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeVolunteerNotifications(
      user.uid,
      (items, meta) => {
        setNotifications(items);
        setUnread(meta?.unreadCount || 0);
      },
      (err) => console.warn("vol notif:", err.message)
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const onDoc = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const markRead = async (n) => {
    if (n.read) return;
    try {
      await markVolunteerNotificationRead(n.id);
    } catch (e) {
      console.warn("mark read:", e.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="vol-header">
      <div className="container vol-header-inner">
        <Link to="/volunteer" className="vol-brand">
          <img src="/logo.webp" alt="מתחברים" width="840" height="507" decoding="async" />
          <strong>מתחברים</strong>
        </Link>
        <nav className="vol-nav">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => isActive ? "active" : ""}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="vol-user" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="התראות"
              style={{
                position: "relative",
                background: "#fff",
                border: "1px solid #e2d8c9",
                borderRadius: 10,
                width: 38,
                height: 38,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#495057",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unread > 0 && (
                <span style={{
                  position: "absolute", top: 2, right: 2, minWidth: 16, height: 16,
                  padding: "0 4px", background: "#dc3545", color: "#fff", borderRadius: 8,
                  border: "2px solid #fff", fontSize: 9, fontWeight: 700,
                  display: "grid", placeItems: "center",
                }}>{unread > 9 ? "9+" : unread}</span>
              )}
            </button>
            {notifOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", insetInlineStart: 0,
                width: 320, maxHeight: 420, overflowY: "auto",
                background: "#fff", border: "1px solid #e2d8c9", borderRadius: 14,
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)", zIndex: 1000,
              }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0e6d6", fontWeight: 700, color: "#8b2c2c" }}>
                  התראות
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#6c757d", fontSize: 14 }}>
                    אין התראות חדשות
                  </div>
                ) : notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f5ece0",
                      cursor: "pointer",
                      background: !n.read ? "#fff7ec" : "#fff",
                    }}
                  >
                    <div style={{ fontWeight: !n.read ? 700 : 500, color: "#3c2a1e", fontSize: 14 }}>
                      {n.title || "התראה"}
                    </div>
                    {n.message && (
                      <div style={{ fontSize: 12, color: "#6c757d", marginTop: 4 }}>{n.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="vol-user-avatar">{initial}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>מתנדבת</div>
          </div>
          <button onClick={handleLogout} className="btn" style={{ marginInlineStart: 10 }}>יציאה</button>
        </div>
      </div>
    </header>
  );
}
