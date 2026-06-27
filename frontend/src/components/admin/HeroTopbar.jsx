import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import { db, auth } from "../../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

export default function HeroTopbar() {
  const navigate = useNavigate();

  const [userData, setUserData] = useState({
    name: "מנהל",
    initial: "מ",
    role: "מנהל מערכת",
  });
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      let finalName = user.displayName;
      try {
        const q = query(
          collection(db, "users"),
          where("email", "==", (user.email || "").toLowerCase())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const data = d.data();
          finalName = finalName || data.displayName || data.fullName || "";
        }
      } catch (e) {
        console.error("hero topbar user fetch:", e);
      }
      if (!finalName && user.email) finalName = user.email.split("@")[0];
      setUserData({
        name: finalName || "מנהל",
        initial: (finalName || "מ").charAt(0).toUpperCase(),
        role: "מנהל מערכת",
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.warn("hero notifications listen error:", err.message);
          setNotifications([]);
        }
      );
    } catch (e) {
      /* noop */
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target))
        setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
      if (!n.read) {
        await updateDoc(doc(db, "notifications", n.id), { read: true });
      }
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
          className="hero-notif-btn"
          onClick={() => {
            setNotifOpen((v) => !v);
            setMenuOpen(false);
          }}
          aria-label="התראות"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="hero-notif-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="hero-dropdown hero-notif-dropdown">
            <div className="hero-dropdown-header">התראות</div>
            {notifications.length === 0 ? (
              <div className="hero-dropdown-empty">אין התראות חדשות</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`hero-notif-item ${!n.read ? "unread" : ""}`}
                  onClick={() => markAsRead(n)}
                >
                  <div className="hero-notif-title">
                    {n.title || "התראה"}
                  </div>
                  {n.message && (
                    <div className="hero-notif-msg">{n.message}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          className="hero-user-chip"
          onClick={() => {
            setMenuOpen((v) => !v);
            setNotifOpen(false);
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div className="hero-user-name">{userData.name}</div>
            <div className="hero-user-role">{userData.role}</div>
          </div>
          <div className="hero-user-avatar">{userData.initial}</div>
        </button>

        {menuOpen && (
          <div className="hero-dropdown hero-user-dropdown">
            <button className="hero-menu-item" onClick={handleLogout}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
