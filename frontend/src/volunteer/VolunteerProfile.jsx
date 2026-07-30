import { useCallback, useEffect, useRef, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import LoadingLine from "@/components/common/LoadingLine.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { useAuth } from "@/context/AuthContext";
import {
  createProfileUpdateRequest,
  getPendingProfileUpdateRequestForVolunteer,
  getProfileUpdateRequestsPageForVolunteer,
} from "@/services/profileUpdateRequestsService";
import { sanitizeText } from "@/utils/sanitize";
import { createOperationId } from "@/utils/operationId";
import {
  User, Phone, Mail, MapPin, IdCard, Home, Users, Activity, Pencil, X, Send,
} from "lucide-react";


export default function VolunteerProfile() {
  const { volunteer, loading, error } = useCurrentVolunteer();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [pendingCheckLoading, setPendingCheckLoading] = useState(true);
  const [pendingCheckError, setPendingCheckError] = useState("");
  const [hasMoreRequests, setHasMoreRequests] = useState(false);
  const historyCursor = useRef(null);

  const loadHistory = useCallback(async ({ reset = false } = {}) => {
    if (!user?.uid) return;
    setHistoryLoading(true);
    setHistoryError("");
    if (reset) {
      setPendingCheckLoading(true);
      setPendingCheckError("");
    }
    try {
      const [pageResult, pendingResult] = await Promise.allSettled([
        getProfileUpdateRequestsPageForVolunteer(user.uid, {
          cursor: reset ? null : historyCursor.current,
        }),
        reset
          ? getPendingProfileUpdateRequestForVolunteer(user.uid)
          : Promise.resolve(undefined),
      ]);
      if (reset && pendingResult.status === "fulfilled") {
        setPendingRequest(pendingResult.value);
      }
      if (reset && pendingResult.status === "rejected") {
        console.warn("profile pending request check:", {
          code: pendingResult.reason?.code || "unknown",
        });
        setPendingRequest(null);
        setPendingCheckError(
          "לא ניתן לאמת כרגע אם קיימת בקשה ממתינה. שליחת בקשה חדשה חסומה עד לרענון."
        );
      }
      if (pageResult.status === "rejected") throw pageResult.reason;
      const page = pageResult.value;
      historyCursor.current = page.cursor;
      setHasMoreRequests(page.hasMore);
      setRequests((current) => reset ? page.items : [...current, ...page.items]);
    } catch (requestError) {
      const code = requestError?.code || "unknown";
      console.warn("profile request history page:", { code });
      setHistoryError(
        code === "permission-denied"
          ? "אין הרשאה לטעון את היסטוריית הבקשות. יש להתחבר מחדש."
          : code === "failed-precondition"
            ? "היסטוריית הבקשות אינה זמינה עד להשלמת הגדרת מסד הנתונים."
            : "לא ניתן לטעון את היסטוריית הבקשות כרגע."
      );
    } finally {
      setHistoryLoading(false);
      if (reset) setPendingCheckLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    historyCursor.current = null;
    setRequests([]);
    setPendingRequest(null);
    setPendingCheckError("");
    if (user?.uid) loadHistory({ reset: true });
  }, [loadHistory, user?.uid]);


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
        {loading && <LoadingLine text="טוען פרטים..." />}
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
              <button
                className="vol-btn vol-btn-primary"
                onClick={() => setModalOpen(true)}
                disabled={pendingCheckLoading || !!pendingRequest || !!pendingCheckError}
                title={
                  pendingRequest
                    ? "קיימת בקשה הממתינה לטיפול"
                    : pendingCheckError || undefined
                }
              >
                <Pencil size={16} />
                {pendingCheckLoading
                  ? "בודק בקשות ממתינות…"
                  : pendingRequest
                    ? "בקשה ממתינה לטיפול"
                    : pendingCheckError
                      ? "לא ניתן לשלוח בקשה כרגע"
                      : "בקשה לעדכון פרטים"}
              </button>
              <span className="vol-profile-note">
                {pendingCheckError ||
                  "לא ניתן לערוך פרטים ישירות. כל בקשת עדכון נשלחת לאישור המנהל."}
              </span>
            </div>

            {(requests.length > 0 || historyLoading || historyError) && (
              <div className="vol-requests-history">
                <h3>היסטוריית בקשות</h3>
                {historyError && <div className="vol-alert-error">{historyError}</div>}
                <div className="vol-requests-list">
                  {requests.map((r) => (
                    <RequestRow key={r.id} request={r} />
                  ))}
                </div>
                {historyLoading && <LoadingLine text="טוען בקשות..." />}
                {hasMoreRequests && !historyLoading && (
                  <button
                    type="button"
                    className="vol-btn vol-btn-outline"
                    onClick={() => loadHistory()}
                    style={{ marginTop: 12 }}
                  >
                    טעינת בקשות נוספות
                  </button>
                )}
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
          onSent={() => loadHistory({ reset: true })}
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

function RequestModal({ volunteer, user, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const operationId = useRef(createOperationId());

  const volunteerName =
    volunteer.name ||
    [volunteer.firstName, volunteer.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    user?.email ||
    "מתנדב";

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = sanitizeText(message, 1000);
    if (!trimmed) { setErr("יש לכתוב הודעה"); return; }
    if (trimmed.length > 1000) { setErr("ההודעה ארוכה מדי (מקסימום 1000 תווים)"); return; }
    if (!user?.uid) { setErr("יש להתחבר מחדש"); return; }
    try {
      setSending(true);
      setErr("");
      await createProfileUpdateRequest({
        volunteerId: volunteer.id,
        volunteerAuthUid: user.uid,
        volunteerName,
        message,
        operationId: operationId.current,
      });
      setSent(true);
      Promise.resolve(onSent?.()).catch((refreshError) => {
        console.warn("profile request history refresh:", refreshError?.code || refreshError?.message);
      });
      setTimeout(onClose, 1400);
    } catch (e2) {
      console.error("submit request error:", { code: e2?.code });
      setErr(
        e2?.code === "profile-update/pending-exists"
          ? "כבר קיימת בקשה הממתינה לטיפול. ניתן לשלוח בקשה חדשה לאחר סיום הטיפול בה."
          : "שגיאה בשליחת הבקשה. נסה שוב."
      );
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
