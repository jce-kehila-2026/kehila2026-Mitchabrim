import { useEffect, useId, useRef, useState } from "react";
import { decideProfileUpdateRequest } from "@/services/profileUpdateRequestsService";

const STATUS_MAP = {
  pending: { label: "ממתין", color: "#a07050", bg: "#fff7ec" },
  approved: { label: "אושר", color: "#2e7d32", bg: "#e8f5e9" },
  rejected: { label: "נדחה", color: "#b3261e", bg: "#ffebee" },
};

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return "";
  return `${date.toLocaleDateString("he-IL")} ${date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function ProfileUpdateRequestStatusBadge({ status }) {
  const current = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: current.color,
        background: current.bg,
        padding: "3px 10px",
        borderRadius: 20,
      }}
    >
      {current.label}
    </span>
  );
}

export default function ProfileUpdateRequestModal({ request, onClose, onDecided }) {
  const [response, setResponse] = useState(request.adminResponse || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  const titleId = useId();
  const isPending = request.status === "pending";

  useEffect(() => {
    closeRef.current = onClose;
    savingRef.current = saving;
  }, [onClose, saving]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !savingRef.current) closeRef.current();
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
      onDecided?.({
        ...request,
        status: decision,
        adminResponse: response,
        reviewedAt: new Date(),
      });
      onClose();
    } catch (error) {
      console.error("Profile update request decision failed:", {
        code: error?.code,
        requestId: request.id,
      });
      setErr("לא ניתן לעדכן את הבקשה. נסו שוב או בדקו את החיבור וההרשאות.");
    } finally {
      setSaving(false);
    }
  };

  const createdAt = formatDateTime(request.createdAt);
  const reviewedAt = formatDateTime(request.reviewedAt);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,15,8,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        direction: "rtl",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: "#fff",
          borderRadius: 18,
          width: 600,
          maxWidth: "100%",
          maxHeight: "calc(100dvh - 32px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflowY: "auto",
          overscrollBehavior: "contain",
          textAlign: "right",
        }}
      >
        <div
          style={{
            padding: "18px clamp(16px, 4vw, 22px)",
            background: "linear-gradient(135deg,#8b2c2c,#a64d4d)",
            color: "#fff",
            borderRadius: "18px 18px 0 0",
          }}
        >
          <div id={titleId} style={{ fontSize: 18, fontWeight: 700 }}>
            בקשת עדכון פרטים
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
            {request.volunteerName || "מתנדב"}
          </div>
          {createdAt && (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
              נשלח ב-{createdAt}
            </div>
          )}
        </div>

        <div style={{ padding: "clamp(16px, 4vw, 22px)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <Detail label="סטטוס">
              <ProfileUpdateRequestStatusBadge status={request.status} />
            </Detail>
            <Detail label="מזהה מתנדב" value={request.volunteerId || "לא צוין"} />
            <Detail label="מזהה בקשה" value={request.id} ltr />
            {request.operationId && (
              <Detail label="מזהה פעולה" value={request.operationId} ltr />
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>הודעת המתנדב</div>
            <div
              style={{
                background: "#fdfbf7",
                border: "1px solid #f0e6d6",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                color: "#3c2a1e",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {request.message || "לא צורפה הודעה"}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>תגובה למתנדב (אופציונלי)</label>
            <textarea
              className="textarea"
              rows={3}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              maxLength={500}
              disabled={!isPending}
              placeholder="הוסף תגובה שתופיע למתנדב בהתראה"
              style={{ marginTop: 6, width: "100%", resize: "vertical" }}
            />
          </div>

          {!isPending && (
            <div
              style={{
                background: "#faf8f5",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 14,
                color: "#6c757d",
                fontSize: 12,
              }}
            >
              {reviewedAt && <div>נסקרה ב-{reviewedAt}</div>}
              {request.reviewedBy && (
                <div style={{ marginTop: reviewedAt ? 4 : 0 }}>
                  מזהה מטפל: <span dir="ltr">{request.reviewedBy}</span>
                </div>
              )}
              {request.adminResponse && (
                <div style={{ marginTop: 8, color: "#3c2a1e", whiteSpace: "pre-wrap" }}>
                  תגובת המנהל: {request.adminResponse}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              background: "#fff7ec",
              border: "1px solid #f0e6d6",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              color: "#7a5a4a",
              marginBottom: 14,
            }}
          >
            שים לב: אישור הבקשה אינו מעדכן את פרטי המתנדב באופן אוטומטי.
            לעדכון בפועל, יש לבצע את השינוי ידנית במסך ניהול מתנדבים.
          </div>

          {err && (
            <div role="alert" style={{ color: "#b3261e", fontSize: 13, marginBottom: 10 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
            <button ref={closeButtonRef} className="btn" onClick={onClose} disabled={saving}>
              סגירה
            </button>
            {isPending && (
              <>
                <button
                  className="btn"
                  style={{ background: "#fff", borderColor: "#b3261e", color: "#b3261e" }}
                  onClick={() => decide("rejected")}
                  disabled={saving}
                >
                  {saving ? "מעדכן…" : "דחייה"}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: "#2e7d32" }}
                  onClick={() => decide("approved")}
                  disabled={saving}
                >
                  {saving ? "מעדכן…" : "אישור"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#7a5a4a",
  marginBottom: 6,
};

function Detail({ label, value, children, ltr = false }) {
  return (
    <div style={{ background: "#faf8f5", borderRadius: 9, padding: "9px 11px", minWidth: 0 }}>
      <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
      {children || (
        <div
          dir={ltr ? "ltr" : undefined}
          style={{ color: "#3c2a1e", fontSize: 13, overflowWrap: "anywhere" }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
