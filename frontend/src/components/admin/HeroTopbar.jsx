import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeAdminNotifications,
  markAdminNotificationRead,
} from "../../services/notificationsService";

const MAX_NOTIFICATIONS = 10;

function formatNotifDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d || isNaN(d)) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `היום · ${time}`;
    const date = d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

export default function HeroTopbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [userData, setUserData] = useState({ name: "מנהל", initial: "מ", role: "מנהל מערכת" });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifPos, setNotifPos] = useState({ top: 0, right: 0 });
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const notifBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const notifDropdownRef = useRef(null);
  const menuDropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    {
      let finalName = user.displayName;
      if (!finalName && user.email) finalName = user.email.split("@")[0];
      setUserData({
        name: finalName || "מנהל",
        initial: (finalName || "מ").charAt(0).toUpperCase(),
        role: "מנהל מערכת",
      });
    }
  }, [user]);

  useEffect(() => {
    const unsub = subscribeAdminNotifications(
      (items, meta) => {
        setNotifications(items);
        setUnreadCount(meta?.unreadCount || 0);
      },
      (err) => {
        console.warn("hero notifications listen error:", err.message);
        setNotifications([]);
      },
      { max: MAX_NOTIFICATIONS }
    );
    return () => unsub();
  }, []);

  // Outside click — treat the fixed dropdown as part of its trigger.
  useEffect(() => {
    const onDocClick = (e) => {
      const t = e.target;
      if (
        menuRef.current && !menuRef.current.contains(t) &&
        !(menuDropdownRef.current && menuDropdownRef.current.contains(t))
      ) setMenuOpen(false);
      if (
        notifRef.current && !notifRef.current.contains(t) &&
        !(notifDropdownRef.current && notifDropdownRef.current.contains(t))
      ) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Position dropdowns via fixed coordinates so they escape .admin-hero (overflow:hidden).
  useLayoutEffect(() => {
    if (!notifOpen || !notifBtnRef.current) return;
    const r = notifBtnRef.current.getBoundingClientRect();
    setNotifPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [notifOpen]);
  useLayoutEffect(() => {
    if (!menuOpen || !menuBtnRef.current) return;
    const r = menuBtnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("שגיאה בהתנתקות:", error);
    }
  };

  const markAsRead = async (n) => {
    try {
      if (!n.read) await markAdminNotificationRead(n.id);
    } catch (e) {
      console.warn("mark read failed:", e.message);
    }
    if (n.type === "profile_update_request" && n.requestId) {
      setNotifOpen(false);
      navigate(`/admin/profile-update-requests?id=${n.requestId}`);
    } else if (n.type === "join_request") {
      setNotifOpen(false);
      navigate("/admin");
    }
  };

  return (
    <div className="elderly-hero-topbar">
      {/* Notifications */}
      <div ref={notifRef} style={{ position: "relative" }}>
        <button
          ref={notifBtnRef}
          className="hero-notif-btn"
          onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
          aria-label="התראות"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="hero-notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </button>

        {notifOpen && (
          <div
            ref={notifDropdownRef}
            className="hero-dropdown hero-notif-dropdown"
            style={{ position: "fixed", top: notifPos.top, right: notifPos.right, left: "auto" }}
          >
            <div className="hero-dropdown-header">
              התראות
              <span style={{ float: "left", fontSize: 11, color: "#9e8a7a", fontWeight: 500 }}>
                {notifications.length}/{MAX_NOTIFICATIONS}
              </span>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div className="hero-dropdown-empty">אין התראות חדשות</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`hero-notif-item ${!n.read ? "unread" : ""}`}
                    onClick={() => markAsRead(n)}
                  >
                    <div className="hero-notif-title">{n.title || "התראה"}</div>
                    {n.message && <div className="hero-notif-msg">{n.message}</div>}
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#9e8a7a", fontWeight: 500 }}>
                      <span>🕒</span>
                      <span>{formatNotifDate(n.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          ref={menuBtnRef}
          className="hero-user-chip"
          onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
        >
          <div style={{ textAlign: "right" }}>
            <div className="hero-user-name">{userData.name}</div>
            <div className="hero-user-role">{userData.role}</div>
          </div>
          <div className="hero-user-avatar">{userData.initial}</div>
        </button>

        {menuOpen && (
          <div
            ref={menuDropdownRef}
            className="hero-dropdown hero-user-dropdown"
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, left: "auto" }}
          >
            <button className="hero-menu-item" onClick={() => { setMenuOpen(false); navigate("/admin/profile"); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              פרופיל אישי
            </button>
            <div style={{ height: 1, background: "#f0e6d6" }} />
            <button className="hero-menu-item" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              התנתקות
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
