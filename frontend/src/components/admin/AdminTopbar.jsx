import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import { auth } from "../../firebase";
import {
  getUserByEmail,
  updateUserProfileFields,
} from "../../services/usersService";
import {
  subscribeAdminNotifications,
  markAdminNotificationRead,
} from "../../services/notificationsService";

export default function AdminTopbar() {
  const navigate = useNavigate();

  const [userData, setUserData] = useState({
    uid: null,
    docId: null,
    name: "טוען...",
    fullName: "",
    email: "",
    phoneNumber: "",
    role: "מנהל מערכת",
    initial: "⏳",
    status: "פעיל",
    createdAt: null,
    updatedAt: null,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);

  const menuRef = useRef(null);
  const notifRef = useRef(null);

  // Fetch logged-in user data
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      let finalName = user.displayName;
      let docId = user.uid;
      let phoneNumber = "";
      let fullName = "";
      let status = "פעיל";
      let createdAt = null;
      let updatedAt = null;

      try {
        const data = await getUserByEmail(user.email);
        if (data) {
          docId = data.id;
          fullName = data.fullName || data.displayName || "";
          finalName = finalName || data.displayName || data.fullName;
          phoneNumber = data.phoneNumber || "";
          status = data.status || "פעיל";
          createdAt = data.createdAt || null;
          updatedAt = data.updatedAt || null;
        }
      } catch (e) {
        console.error("topbar user fetch:", e);
      }

      if (!finalName && user.email) finalName = user.email.split("@")[0];

      setUserData({
        uid: user.uid,
        docId,
        name: finalName || "מנהל",
        fullName: fullName || finalName || "",
        email: user.email || "",
        phoneNumber,
        role: "מנהל מערכת",
        initial: (finalName || "מ").charAt(0).toUpperCase(),
        status,
        createdAt,
        updatedAt,
      });
    });
    return () => unsubscribe();
  }, []);

  // Notifications subscription
  useEffect(() => {
    const unsub = subscribeAdminNotifications(
      (items) => {
        setNotifications(items);
        setNotifLoading(false);
      },
      (err) => {
        console.warn("notifications listen error:", err.message);
        setNotifications([]);
        setNotifLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
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
        await markAdminNotificationRead(n.id);
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

  const handleProfileSaved = (updated) => {
    setUserData((p) => ({
      ...p,
      fullName: updated.fullName,
      name: updated.fullName || p.name,
      phoneNumber: updated.phoneNumber,
      initial: (updated.fullName || p.name || "מ").charAt(0).toUpperCase(),
      updatedAt: updated.updatedAt,
    }));
  };

  return (
    <div
      className="admin-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "12px 24px",
        backgroundColor: "#fdfbf7",
        borderBottom: "1px solid #e9ecef",
        position: "relative",
      }}
    >
      <style>{`
        .topbar-btn { transition: all 0.2s ease; cursor: pointer; }
        .topbar-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(139,44,44,0.15); }
        .tb-dropdown {
          position: absolute; top: calc(100% + 8px); background: #fff;
          border: 1px solid #e2d8c9; border-radius: 14px;
          box-shadow: 0 10px 30px rgba(139,44,44,0.12);
          z-index: 1000; overflow: hidden; animation: tbFade .15s ease;
        }
        @keyframes tbFade { from { opacity: 0; transform: translateY(-4px); } to { opacity:1; transform:none; } }
        .tb-menu-item {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; cursor: pointer; font-size: 14px; color: #3c2a1e;
          background: #fff; border: none; width: 100%; text-align: right;
          font-family: inherit; transition: background .15s;
        }
        .tb-menu-item:hover { background: #fdf4e9; }
        .tb-menu-item.danger { color: #8b2c2c; }
        .tb-menu-sep { height: 1px; background: #f0e6d6; }
        .tb-notif-item { padding: 12px 16px; border-bottom: 1px solid #f5ece0; cursor: pointer; transition: background .15s; }
        .tb-notif-item:hover { background: #fdf4e9; }
        .tb-notif-item.unread { background: #fff7ec; }
        .tb-notif-item:last-child { border-bottom: none; }
        .tb-modal-backdrop {
          position: fixed; inset: 0; background: rgba(40,20,10,0.45);
          z-index: 2000; display: flex; align-items: center; justify-content: center;
          animation: tbFade .15s ease;
        }
        .tb-modal {
          background: #fffaf2; border-radius: 18px; padding: 28px;
          width: 460px; max-width: 92vw; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .tb-input {
          width: 100%; padding: 10px 14px; border-radius: 10px;
          border: 1px solid #e2d8c9; font-family: inherit; font-size: 14px;
          background: #fff; outline: none; box-sizing: border-box;
        }
        .tb-input:focus { border-color: #8b2c2c; box-shadow: 0 0 0 3px rgba(139,44,44,0.08); }
        .tb-input:disabled { background: #f5ece0; color: #6c757d; }
        .tb-label { display: block; font-size: 13px; font-weight: 600; color: #5a3a2a; margin-bottom: 6px; }

        /* Profile Modal Styles */
        .profile-modal-backdrop {
          position: fixed; inset: 0; background: rgba(30, 15, 8, 0.60);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          z-index: 2000; display: flex; align-items: flex-start; justify-content: center;
          animation: tbFade .2s ease;
          padding: 12vh 20px 40px;
        }
        .profile-modal {
          background: #fff; border-radius: 22px;
          width: 600px; max-width: 100%;
          max-height: 78vh; overflow-y: auto;
          box-shadow: 0 28px 80px rgba(60, 25, 15, 0.28);
          animation: profileSlide .25s cubic-bezier(.22,.61,.36,1);
        }
        @keyframes profileSlide { from { opacity:0; transform: translateY(12px) scale(0.97); } to { opacity:1; transform:none; } }
        .profile-header {
          background: linear-gradient(135deg, #8b2c2c 0%, #a64d4d 100%);
          padding: 32px 28px 24px; text-align: center; position: relative;
          border-radius: 22px 22px 0 0;
        }
        .profile-avatar-large {
          width: 80px; height: 80px; border-radius: 50%;
          background: #fff; color: #8b2c2c;
          display: grid; place-items: center; font-weight: 800; font-size: 32px;
          margin: 0 auto 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          border: 3px solid rgba(255,255,255,0.35);
        }
        .profile-header-name { color: #fff; font-size: 20px; font-weight: 700; margin: 0; }
        .profile-header-email { color: rgba(255,255,255,0.82); font-size: 13px; margin-top: 4px; }
        .profile-header-role {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.18); color: #fff;
          padding: 4px 12px; border-radius: 20px;
          font-size: 11px; font-weight: 600; margin-top: 10px;
          backdrop-filter: blur(4px);
        }
        .profile-body { padding: 24px 28px 28px; }
        .profile-section-title {
          font-size: 11px; font-weight: 700; color: #a07050;
          text-transform: uppercase; letter-spacing: .08em;
          margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
        }
        .profile-info-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        }
        .profile-info-card {
          background: #fdfbf7; border: 1px solid #f0e6d6;
          border-radius: 14px; padding: 14px 16px;
          transition: background .15s, box-shadow .15s;
        }
        .profile-info-card:hover { background: #fdf4e9; box-shadow: 0 4px 12px rgba(139,44,44,0.06); }
        .profile-info-label { font-size: 11px; color: #9e8a7a; font-weight: 600; margin-bottom: 5px; }
        .profile-info-value { font-size: 14px; color: #3c2a1e; font-weight: 700; }
        .profile-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 700;
        }
        .profile-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #2e7d32; }
        .profile-actions {
          display: flex; align-items: center; gap: 10px; margin-top: 24px;
          padding-top: 18px; border-top: 1px solid #f0e6d6;
        }
        .profile-btn-primary {
          background: #8b2c2c; color: #fff; border: none;
          padding: 10px 22px; border-radius: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit; font-size: 14px;
          transition: background .15s, transform .15s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .profile-btn-primary:hover { background: #6b1d1a; transform: translateY(-1px); }
        .profile-btn-primary:disabled { opacity: .65; cursor: not-allowed; transform: none; }
        .profile-btn-secondary {
          background: #fff; color: #8b2c2c; border: 1.5px solid #8b2c2c;
          padding: 10px 22px; border-radius: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit; font-size: 14px;
          transition: background .15s, transform .15s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .profile-btn-secondary:hover { background: #fdf4e9; transform: translateY(-1px); }
        .profile-btn-ghost {
          background: transparent; color: #6c757d; border: none;
          padding: 10px 16px; border-radius: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit; font-size: 13px;
          margin-inline-start: auto;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .profile-btn-ghost:hover { color: #3c2a1e; }
        .profile-alert {
          padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; gap: 8px; margin-top: 16px;
          animation: tbFade .2s ease;
        }
        .profile-alert.success { background: #e8f5e9; color: #2e7d32; }
        .profile-alert.error { background: #ffebee; color: #b3261e; }
        .profile-form-field { margin-bottom: 16px; }
        .profile-form-field:last-child { margin-bottom: 0; }
        .profile-input {
          width: 100%; padding: 11px 14px; border-radius: 12px;
          border: 1.5px solid #e2d8c9; font-family: inherit; font-size: 14px;
          background: #fff; outline: none; box-sizing: border-box;
          transition: border-color .15s, box-shadow .15s;
        }
        .profile-input:focus { border-color: #8b2c2c; box-shadow: 0 0 0 3px rgba(139,44,44,0.08); }
        .profile-input:disabled { background: #f5ece0; color: #6c757d; }
        .profile-label { display: block; font-size: 12px; font-weight: 700; color: #7a5a4a; margin-bottom: 6px; }
        .profile-input-wrap { position: relative; }
        .profile-input-icon { position: absolute; top: 50%; inset-inline-end: 12px; transform: translateY(-50%); color: #b0a090; pointer-events: none; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            className="topbar-btn"
            onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
            style={{
              position: "relative", backgroundColor: "#fff", border: "1px solid #e9ecef",
              borderRadius: "12px", width: "42px", height: "42px",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#495057",
            }}
            aria-label="התראות"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: "4px", right: "4px", minWidth: "18px", height: "18px",
                padding: "0 5px", backgroundColor: "#dc3545", color: "#fff", borderRadius: "9px",
                border: "2px solid #fff", fontSize: "10px", fontWeight: "bold",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="tb-dropdown" style={{ left: 0, width: 320, maxHeight: 420, overflowY: "auto" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0e6d6", fontWeight: "bold", color: "#8b2c2c" }}>
                התראות
              </div>
              {notifLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#6c757d", fontSize: 13 }}>טוען...</div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: "#6c757d", fontSize: 14 }}>
                  אין התראות חדשות
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`tb-notif-item ${!n.read ? "unread" : ""}`}
                    onClick={() => markAsRead(n)}
                  >
                    <div style={{ fontWeight: !n.read ? "bold" : "normal", color: "#3c2a1e", fontSize: 14 }}>
                      {n.title || "התראה"}
                    </div>
                    {n.message && (
                      <div style={{ fontSize: 12, color: "#6c757d", marginTop: 4 }}>{n.message}</div>
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
            className="topbar-btn"
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#fff",
              border: "1px solid #e2d8c9", padding: "4px 16px 4px 4px", borderRadius: "40px",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "bold", color: "#8b2c2c", fontSize: "14px" }}>{userData.name}</div>
              <div style={{ color: "#6c757d", fontSize: "12px" }}>{userData.role}</div>
            </div>
            <div style={{
              width: "38px", height: "38px", backgroundColor: "#8b2c2c", color: "#fff",
              borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "bold", fontSize: "16px",
            }}>
              {userData.initial}
            </div>
          </button>

          {menuOpen && (
            <div className="tb-dropdown" style={{ left: 0, width: 200 }}>
              <button className="tb-menu-item" onClick={() => { setMenuOpen(false); setProfileOpen(true); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                הפרופיל שלי
              </button>
              <div className="tb-menu-sep" />
              <button className="tb-menu-item danger" onClick={handleLogout}>
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

      {profileOpen && (
        <ProfileModal
          userData={userData}
          onClose={() => setProfileOpen(false)}
          onSaved={handleProfileSaved}
        />
      )}
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "לא זמין";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "לא זמין";
  }
}

function ProfileModal({ userData, onClose, onSaved }) {
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(userData.fullName || userData.name || "");
  const [phoneNumber, setPhoneNumber] = useState(userData.phoneNumber || "");
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', text: string }

  useEffect(() => {
    setFullName(userData.fullName || userData.name || "");
    setPhoneNumber(userData.phoneNumber || "");
  }, [userData]);

  const save = async (e) => {
    e.preventDefault();
    if (!userData.docId) {
      setAlert({ type: "error", text: "לא ניתן לזהות את המשתמש" });
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      const now = await updateUserProfileFields(userData.docId, {
        fullName,
        phoneNumber,
      });
      onSaved({ fullName, phoneNumber, updatedAt: now });
      setAlert({ type: "success", text: "הפרופיל נשמר בהצלחה" });
      setEditMode(false);
      setTimeout(() => setAlert(null), 3000);
    } catch (e) {
      console.error(e);
      setAlert({ type: "error", text: "שגיאה בשמירת הפרופיל" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(userData.fullName || userData.name || "");
    setPhoneNumber(userData.phoneNumber || "");
    setEditMode(false);
    setAlert(null);
  };

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-header">
          <div className="profile-avatar-large">{userData.initial}</div>
          <h3 className="profile-header-name">{userData.name}</h3>
          <div className="profile-header-email">{userData.email}</div>
          <div className="profile-header-role">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {userData.role}
          </div>
        </div>

        {/* Body */}
        <div className="profile-body">
          {editMode ? (
            <form onSubmit={save}>
              <div className="profile-section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                עריכת פרטים אישיים
              </div>

              <div className="profile-form-field">
                <label className="profile-label">שם מלא</label>
                <div className="profile-input-wrap">
                  <input
                    className="profile-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="הקלד שם מלא"
                    required
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="profile-form-field">
                <label className="profile-label">טלפון</label>
                <div className="profile-input-wrap">
                  <input
                    className="profile-input"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="הקלד מספר טלפון"
                    dir="rtl"
                    type="tel"
                  />
                  <span className="profile-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.06 12.06 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.06 12.06 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="profile-form-field">
                <label className="profile-label">אימייל</label>
                <input className="profile-input" value={userData.email} disabled dir="rtl" />
              </div>

              <div className="profile-form-field">
                <label className="profile-label">תפקיד</label>
                <input className="profile-input" value={userData.role} disabled dir="rtl" />
              </div>

              {alert && (
                <div className={`profile-alert ${alert.type}`}>
                  {alert.type === "success" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                  {alert.text}
                </div>
              )}

              <div className="profile-actions">
                <button type="submit" className="profile-btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                      </svg>
                      שומר...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      שמירת שינויים
                    </>
                  )}
                </button>
                <button type="button" className="profile-btn-secondary" onClick={handleCancel} disabled={saving}>
                  ביטול
                </button>
                <button type="button" className="profile-btn-ghost" onClick={onClose}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  סגירה
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                פרטי פרופיל
              </div>

              <div className="profile-info-grid">
                <div className="profile-info-card">
                  <div className="profile-info-label">שם מלא</div>
                  <div className="profile-info-value">{userData.fullName || userData.name || "—"}</div>
                </div>
                <div className="profile-info-card">
                  <div className="profile-info-label">טלפון</div>
                  <div className="profile-info-value">{userData.phoneNumber || "—"}</div>
                </div>
                <div className="profile-info-card">
                  <div className="profile-info-label">אימייל</div>
                  <div className="profile-info-value" style={{ fontSize: 12.5, wordBreak: "break-word" }}>{userData.email || "—"}</div>
                </div>
                <div className="profile-info-card">
                  <div className="profile-info-label">תפקיד</div>
                  <div className="profile-info-value">{userData.role}</div>
                </div>
                <div className="profile-info-card">
                  <div className="profile-info-label">סטטוס חשבון</div>
                  <div className="profile-info-value">
                    <span className="profile-status-badge">
                      <span className="profile-status-dot" />
                      {userData.status}
                    </span>
                  </div>
                </div>
                <div className="profile-info-card">
                  <div className="profile-info-label">עדכון אחרון</div>
                  <div className="profile-info-value" style={{ fontSize: 12.5 }}>{formatDate(userData.updatedAt)}</div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="profile-info-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="profile-info-label">תאריך יצירה</div>
                    <div className="profile-info-value" style={{ fontSize: 12.5 }}>{formatDate(userData.createdAt)}</div>
                  </div>
                </div>
              </div>

              <div className="profile-actions">
                <button className="profile-btn-primary" onClick={() => setEditMode(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  עריכת פרופיל
                </button>
                <button className="profile-btn-secondary" onClick={onClose}>
                  סגירה
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

