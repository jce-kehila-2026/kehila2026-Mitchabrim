import { useEffect, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { useAuth } from "@/context/AuthContext";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  User, Phone, Mail, MapPin, IdCard, Home, Users, Activity, Pencil, X, Send,
} from "lucide-react";

export default function VolunteerProfile() {
  const { volunteer, loading, error } = useCurrentVolunteer();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [requests, setRequests] = useState([]);

  // Subscribe to this volunteer's own requests
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "profileUpdateRequests"),
      where("volunteerAuthUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("requests listen:", err.message)
    );
    return () => unsub();
  }, [user?.uid]);

  const fullName =
    volunteer?.name ||
    [volunteer?.firstName, volunteer?.lastName].filter(Boolean).join(" ") ||
    "";

  const fields = volunteer
    ? [
        { icon: <User size={14} />, label: "שם פרטי", value: volunteer.firstName || fullName.split(" ")[0] || "—" },
        { icon: <User size={14} />, label: "שם משפחה", value: volunteer.lastName || fullName.split(" ").slice(1).join(" ") || "—" },
        { icon: <IdCard size={14} />, label: "ת.ז", value: volunteer.idNumber || "—" },
        { icon: <Phone size={14} />, label: "טלפון", value: volunteer.phone || "—" },
        { icon: <Mail size={14} />, label: "אימייל", value: volunteer.email || "—" },
        { icon: <Home size={14} />, label: "כתובת", value: volunteer.address || "—" },
        { icon: <MapPin size={14} />, label: "אזור", value: volunteer.area || "—" },
        { icon: <MapPin size={14} />, label: "שכונה", value: volunteer.neighborhood || "—" },
        { icon: <Users size={14} />, label: "קבוצה", value: volunteer.group || "ללא קבוצה" },
        { icon: <Activity size={14} />, label: "סטטוס", value: volunteer.status || "פעיל" },
      ]
    : [];

  return (
    <VolunteerLayout title="הפרטים שלי" subtitle="צפייה בלבד — לעדכון פרטים יש לשלוח בקשה למנהל">
      <div className="vol-profile-readonly">
        {loading && <p>טוען פרטים...</p>}
        {!loading && error && <div className="vol-alert-error">{error}</div>}
        {!loading && !error && volunteer && (
          <>
            <div className="vol-profile-readonly-grid">
              {fields.map((f) => (
                <div key={f.label} className="vol-readonly-field">
                  <div className="vol-readonly-label">
                    <span className="vol-readonly-icon">{f.icon}</span>
                    {f.label}
                  </div>
                  <div className="vol-readonly-value">{f.value}</div>
                </div>
              ))}
            </div>

            <div className="vol-profile-action">
              <button className="vol-btn vol-btn-primary" onClick={() => setModalOpen(true)}>
                <Pencil size={16} />
                בקשה לעדכון פרטים
              </button>
              <span className="vol-profile-note">
                לא ניתן לערוך פרטים ישירות. כל בקשת עדכון נשלחת לאישור המנהל.
              </span>
            </div>

            {requests.length > 0 && (
              <div className="vol-requests-history">
                <h3>היסטוריית בקשות</h3>
                <div className="vol-requests-list">
                  {requests.map((r) => (
                    <RequestRow key={r.id} request={r} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && volunteer && (
        <RequestModal
          volunteer={volunteer}
          user={user}
          onClose={() => setModalOpen(false)}
        />
      )}
    </VolunteerLayout>
  );
}

function RequestRow({ request }) {
  const statusMap = {
    pending: { label: "ממתין לטיפול", cls: "pending" },
    approved: { label: "אושר", cls: "approved" },
    rejected: { label: "נדחה", cls: "rejected" },
  };
  const s = statusMap[request.status] || statusMap.pending;
  const d = request.createdAt?.toDate ? request.createdAt.toDate() : null;
  return (
    <div className="vol-request-row">
      <div className="vol-request-row-head">
        <span className={`vol-status-badge ${s.cls}`}>{s.label}</span>
        {d && <span className="vol-request-date">{d.toLocaleDateString("he-IL")}</span>}
      </div>
      <div className="vol-request-message">{request.message}</div>
      {request.adminResponse && (
        <div className="vol-request-response">
          <strong>תגובת המנהל:</strong> {request.adminResponse}
        </div>
      )}
    </div>
  );
}

function RequestModal({ volunteer, user, onClose }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const volunteerName =
    volunteer.name ||
    [volunteer.firstName, volunteer.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    user?.email ||
    "מתנדב";

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) { setErr("יש לכתוב הודעה"); return; }
    if (trimmed.length > 1000) { setErr("ההודעה ארוכה מדי (מקסימום 1000 תווים)"); return; }
    if (!user?.uid) { setErr("יש להתחבר מחדש"); return; }
    try {
      setSending(true);
      setErr("");
      const reqRef = await addDoc(collection(db, "profileUpdateRequests"), {
        volunteerId: volunteer.id,
        volunteerAuthUid: user.uid,
        volunteerName,
        message: trimmed,
        status: "pending",
        createdAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        adminResponse: "",
      });
      await addDoc(collection(db, "notifications"), {
        audience: "admin",
        type: "profile_update_request",
        title: "בקשה חדשה לעדכון פרטי מתנדב",
        message: `${volunteerName} שלח/ה בקשה לעדכון פרטים`,
        requestId: reqRef.id,
        read: false,
        createdAt: serverTimestamp(),
      });
      setSent(true);
      setTimeout(onClose, 1400);
    } catch (e2) {
      console.error("submit request error:", e2);
      setErr("שגיאה בשליחת הבקשה. נסה שוב.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="vol-modal-overlay" onClick={onClose}>
      <div className="vol-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vol-modal-header">
          <div>
            <h3>בקשה לעדכון פרטים</h3>
            <p>אנא מלא את הפרטים החדשים שתרצה/י לעדכן. הבקשה תישלח למנהל לאישור.</p>
          </div>
          <button type="button" className="vol-modal-close" onClick={onClose} aria-label="סגירה">
            <X size={18} />
          </button>
        </div>
        {sent ? (
          <div className="vol-alert-success">הבקשה נשלחה בהצלחה</div>
        ) : (
          <form onSubmit={submit} className="vol-modal-body">
            <div className="vol-field">
              <label>הודעה למנהל</label>
              <textarea
                className="textarea vol-modal-textarea"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                placeholder="לדוגמה: ברצוני לעדכן את מספר הטלפון שלי ל..."
              />
              <div className="vol-modal-counter">{message.length}/1000</div>
            </div>
            {err && <div className="vol-alert-error" style={{ marginTop: 8 }}>{err}</div>}
            <div className="vol-modal-footer">
              <button type="button" className="vol-btn vol-btn-outline" onClick={onClose} disabled={sending}>
                ביטול
              </button>
              <button type="submit" className="vol-btn vol-btn-primary" disabled={sending}>
                <Send size={16} />
                {sending ? "שולח..." : "שליחה"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RequestRow({ request }) {
  const statusMap = {
    pending: { label: "ממתין לטיפול", color: "#a07050", bg: "#fff7ec" },
    approved: { label: "אושר", color: "#2e7d32", bg: "#e8f5e9" },
    rejected: { label: "נדחה", color: "#b3261e", bg: "#ffebee" },
  };
  const s = statusMap[request.status] || statusMap.pending;
  const d = request.createdAt?.toDate ? request.createdAt.toDate() : null;
  return (
    <div
      style={{
        border: "1px solid #f0e6d6",
        borderRadius: 12,
        padding: "12px 14px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: s.color,
            background: s.bg,
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          {s.label}
        </span>
        {d && (
          <span style={{ fontSize: 12, color: "#9e8a7a" }}>
            {d.toLocaleDateString("he-IL")}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, color: "#3c2a1e", whiteSpace: "pre-wrap" }}>
        {request.message}
      </div>
      {request.adminResponse && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "#fdfbf7",
            borderRadius: 8,
            fontSize: 13,
            color: "#5a3a2a",
          }}
        >
          <strong>תגובת המנהל:</strong> {request.adminResponse}
        </div>
      )}
    </div>
  );
}

function RequestModal({ volunteer, user, onClose }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const volunteerName =
    volunteer.name ||
    [volunteer.firstName, volunteer.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    user?.email ||
    "מתנדב";

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setErr("יש לכתוב הודעה");
      return;
    }
    if (trimmed.length > 1000) {
      setErr("ההודעה ארוכה מדי (מקסימום 1000 תווים)");
      return;
    }
    if (!user?.uid) {
      setErr("יש להתחבר מחדש");
      return;
    }
    try {
      setSending(true);
      setErr("");
      const reqRef = await addDoc(collection(db, "profileUpdateRequests"), {
        volunteerId: volunteer.id,
        volunteerAuthUid: user.uid,
        volunteerName,
        message: trimmed,
        status: "pending",
        createdAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        adminResponse: "",
      });
      // Admin notification
      await addDoc(collection(db, "notifications"), {
        audience: "admin",
        type: "profile_update_request",
        title: "בקשה חדשה לעדכון פרטי מתנדב",
        message: `${volunteerName} שלח/ה בקשה לעדכון פרטים`,
        requestId: reqRef.id,
        read: false,
        createdAt: serverTimestamp(),
      });
      setSent(true);
      setTimeout(onClose, 1400);
    } catch (e2) {
      console.error("submit request error:", e2);
      setErr("שגיאה בשליחת הבקשה. נסה שוב.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,15,8,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "10vh 16px 40px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fffaf2",
          borderRadius: 18,
          padding: 24,
          width: 520,
          maxWidth: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 6, color: "#8b2c2c" }}>בקשה לעדכון פרטים</h3>
        <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "#6c757d" }}>
          כתוב/י כאן מה תרצה/י לעדכן בפרטים שלך. הבקשה תישלח למנהל.
        </p>
        {sent ? (
          <div className="join-success">הבקשה נשלחה בהצלחה</div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#5a3a2a" }}>הודעה למנהל</label>
            <textarea
              className="textarea"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              placeholder="לדוגמה: ברצוני לעדכן את מספר הטלפון שלי ל..."
              style={{ marginTop: 6, width: "100%" }}
            />
            <div style={{ fontSize: 11, color: "#9e8a7a", textAlign: "left", marginTop: 4 }}>
              {message.length}/1000
            </div>
            {err && (
              <div style={{ color: "#b3261e", fontSize: 13, marginTop: 8 }}>{err}</div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={onClose} disabled={sending}>
                ביטול
              </button>
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? "שולח..." : "שליחה"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
