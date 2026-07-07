import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import LoadingLine from "@/components/common/LoadingLine.jsx";
import EmptyState from "@/components/common/EmptyState.jsx";
import {
  subscribeAllProfileUpdateRequests,
  decideProfileUpdateRequest,
} from "@/services/profileUpdateRequestsService";



export default function ProfileUpdateRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all|pending|approved|rejected
  const [active, setActive] = useState(null);
  const [params] = useSearchParams();

  useEffect(() => {
    const unsub = subscribeAllProfileUpdateRequests(
      (list) => {
        setRequests(list);
        setLoading(false);
      },
      (err) => {
        console.warn("requests listen:", err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);


  // Open specific request via ?id=
  useEffect(() => {
    const id = params.get("id");
    if (id && requests.length) {
      const r = requests.find((x) => x.id === id);
      if (r) setActive(r);
    }
  }, [params, requests]);

  const filtered = requests.filter((r) => filter === "all" || r.status === filter);

  return (
    <AdminLayout title="בקשות לעדכון פרטי מתנדבים" subtitle="ניהול בקשות שנשלחו מהמתנדבים">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { k: "all", label: "הכל" },
            { k: "pending", label: "ממתינות" },
            { k: "approved", label: "אושרו" },
            { k: "rejected", label: "נדחו" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={filter === t.k ? "btn btn-primary" : "btn"}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingLine />
        ) : filtered.length === 0 ? (
          <EmptyState text="אין בקשות להצגה" style={{ color: "#6c757d" }} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map((r) => (
              <RequestCard key={r.id} request={r} onOpen={() => setActive(r)} />
            ))}
          </div>
        )}
      </div>

      {active && (
        <RequestDetailModal
          request={active}
          onClose={() => setActive(null)}
        />
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: "ממתין", color: "#a07050", bg: "#fff7ec" },
    approved: { label: "אושר", color: "#2e7d32", bg: "#e8f5e9" },
    rejected: { label: "נדחה", color: "#b3261e", bg: "#ffebee" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color: s.color, background: s.bg,
      padding: "3px 10px", borderRadius: 20,
    }}>{s.label}</span>
  );
}

function RequestCard({ request, onOpen }) {
  const d = request.createdAt?.toDate ? request.createdAt.toDate() : null;
  return (
    <div
      onClick={onOpen}
      style={{
        border: "1px solid #f0e6d6",
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, color: "#3c2a1e" }}>{request.volunteerName}</div>
        <StatusBadge status={request.status} />
      </div>
      <div style={{ fontSize: 13, color: "#5a3a2a", whiteSpace: "pre-wrap", marginBottom: 6 }}>
        {request.message.length > 160 ? request.message.slice(0, 160) + "…" : request.message}
      </div>
      {d && (
        <div style={{ fontSize: 12, color: "#9e8a7a" }}>
          {d.toLocaleDateString("he-IL")} {d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

function RequestDetailModal({ request, onClose }) {
  const [response, setResponse] = useState(request.adminResponse || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const d = request.createdAt?.toDate ? request.createdAt.toDate() : null;
  const dr = request.reviewedAt?.toDate ? request.reviewedAt.toDate() : null;
  const isPending = request.status === "pending";

  const decide = async (decision) => {
    try {
      setSaving(true);
      setErr("");
      await decideProfileUpdateRequest({
        requestId: request.id,
        volunteerAuthUid: request.volunteerAuthUid,
        decision,
        response,
      });
      onClose();
    } catch (e) {
      console.error(e);
      setErr("שגיאה בעדכון הבקשה");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(30,15,8,0.55)",
        backdropFilter: "blur(6px)", zIndex: 2000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "8vh 16px 40px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 18, width: 560, maxWidth: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#8b2c2c,#a64d4d)", color: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{request.volunteerName}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            {d ? `נשלח ב-${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "#6c757d" }}>סטטוס:</span>
            <StatusBadge status={request.status} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7a5a4a", marginBottom: 6 }}>הודעת המתנדב</div>
            <div style={{
              background: "#fdfbf7", border: "1px solid #f0e6d6", borderRadius: 10,
              padding: "12px 14px", fontSize: 14, color: "#3c2a1e", whiteSpace: "pre-wrap",
            }}>{request.message}</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a4a" }}>תגובה למתנדב (אופציונלי)</label>
            <textarea
              className="textarea"
              rows={3}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              maxLength={500}
              disabled={!isPending && !!request.adminResponse}
              placeholder="הוסף תגובה שתופיע למתנדב בהתראה"
              style={{ marginTop: 6, width: "100%" }}
            />
          </div>

          {!isPending && dr && (
            <div style={{ fontSize: 12, color: "#9e8a7a", marginBottom: 12 }}>
              נסקרה ב-{dr.toLocaleDateString("he-IL")} {dr.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          <div style={{
            background: "#fff7ec", border: "1px solid #f0e6d6", borderRadius: 10,
            padding: "10px 12px", fontSize: 12, color: "#7a5a4a", marginBottom: 14,
          }}>
            שים לב: אישור הבקשה אינו מעדכן את פרטי המתנדב באופן אוטומטי.
            לעדכון בפועל, יש לבצע את השינוי ידנית במסך ניהול מתנדבים.
          </div>

          {err && <div style={{ color: "#b3261e", fontSize: 13, marginBottom: 10 }}>{err}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>סגירה</button>
            {isPending && (
              <>
                <button
                  className="btn"
                  style={{ background: "#fff", borderColor: "#b3261e", color: "#b3261e" }}
                  onClick={() => decide("rejected")}
                  disabled={saving}
                >
                  דחייה
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: "#2e7d32" }}
                  onClick={() => decide("approved")}
                  disabled={saving}
                >
                  אישור
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
