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
        { label: "שם פרטי", value: volunteer.firstName || fullName.split(" ")[0] || "—" },
        { label: "שם משפחה", value: volunteer.lastName || fullName.split(" ").slice(1).join(" ") || "—" },
        { label: "ת.ז", value: volunteer.idNumber || "—" },
        { label: "טלפון", value: volunteer.phone || "—" },
        { label: "אימייל", value: volunteer.email || "—" },
        { label: "כתובת", value: volunteer.address || "—" },
        { label: "אזור", value: volunteer.area || "—" },
        { label: "שכונה", value: volunteer.neighborhood || "—" },
        { label: "קבוצה", value: volunteer.group || "ללא קבוצה" },
        { label: "סטטוס", value: volunteer.status || "פעיל" },
      ]
    : [];

  return (
    <VolunteerLayout title="הפרטים שלי" subtitle="צפייה בלבד — לעדכון פרטים יש לשלוח בקשה למנהל">
      <div className="card">
        {loading && <p>טוען פרטים...</p>}
        {!loading && error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        {!loading && !error && volunteer && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                marginBottom: 24,
              }}
            >
              {fields.map((f) => (
                <div
                  key={f.label}
                  style={{
                    background: "#fdfbf7",
                    border: "1px solid #f0e6d6",
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#9e8a7a", fontWeight: 600, marginBottom: 4 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 14, color: "#3c2a1e", fontWeight: 600 }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                בקשה לעדכון פרטים
              </button>
              <span style={{ color: "#6c757d", fontSize: 13 }}>
                לא ניתן לערוך פרטים ישירות. כל בקשת עדכון נשלחת לאישור המנהל.
              </span>
            </div>

            {requests.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <h3 style={{ fontSize: 16, marginBottom: 12, color: "#5a3a2a" }}>
                  היסטוריית בקשות
                </h3>
                <div style={{ display: "grid", gap: 10 }}>
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
