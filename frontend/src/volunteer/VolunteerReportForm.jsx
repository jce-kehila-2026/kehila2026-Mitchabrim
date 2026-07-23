import { useEffect, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer.js";
import { getElderlyForVolunteer } from "@/services/elderlyService.js";
import { createVolunteerReport } from "@/services/reportsService.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { validateDate } from "@/utils/validation";
import { sanitizeFormData, sanitizeText } from "@/utils/sanitize";
import { VOLUNTEER_REPORT_TYPES } from "@/services/volunteerReportPolicy.js";
import { Calendar, Tag, User, MessageSquare, Send, Info } from "lucide-react";

const EMPTY_FORM = { date: "", type: "", elderlyId: "", notes: "" };

const volunteerFullName = (v) =>
  v?.fullName || v?.name ||
  [v?.firstName, v?.lastName].filter(Boolean).join(" ").trim() ||
  v?.email || "";

const elderlyFullName = (e) =>
  e?.fullName || e?.name ||
  [e?.firstName, e?.lastName].filter(Boolean).join(" ").trim() || "—";

export default function VolunteerReportForm() {
  const { user } = useAuth();
  const { volunteer, loading: volLoading, linked, error: volError } = useCurrentVolunteer();

  const [myElderly, setMyElderly] = useState([]);
  const [elderlyLoading, setElderlyLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!volunteer?.id) return;
      try {
        setElderlyLoading(true);
        const list = await getElderlyForVolunteer(volunteer.id);
        if (!cancelled) setMyElderly(list);
      } catch (err) {
        console.error("Failed to load elderly:", err);
        if (!cancelled) setMyElderly([]);
      } finally {
        if (!cancelled) setElderlyLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [volunteer?.id]);

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!linked || !volunteer) return;
    setSubmitError("");

    const dateErr = validateDate(form.date);
    if (dateErr) { setSubmitError(`תאריך המפגש: ${dateErr}`); return; }
    if (!form.type) { setSubmitError("יש לבחור סוג מפגש"); return; }

    const selectedElderly = myElderly.find((el) => el.id === form.elderlyId);
    if (!selectedElderly) {
      setSubmitError("יש לבחור אזרח ותיק מהרשימה");
      return;
    }

    const reportPayload = sanitizeFormData({
      volunteerId: volunteer.id,
      volunteerAuthUid: user?.uid || null,
      volunteerName: volunteerFullName(volunteer),
      volunteerEmail: user?.email || null,
      elderlyId: selectedElderly.id,
      elderlyName: elderlyFullName(selectedElderly),
      reportDate: form.date,
      reportType: form.type,
      notes: sanitizeText(form.notes, 2000),
    });

    try {
      setSubmitting(true);
      await createVolunteerReport(reportPayload);
      setSent(true);
      setForm(EMPTY_FORM);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("createVolunteerReport error:", err);
      setSubmitError("שגיאה בשליחת הדוח. נסה/י שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  if (volLoading) {
    return (
      <VolunteerLayout title="הגשת דוח מפגש" subtitle="טוען...">
        <div className="vol-card vol-card-pad"><p>טוען נתוני מתנדב...</p></div>
      </VolunteerLayout>
    );
  }

  if (!linked) {
    return (
      <VolunteerLayout title="הגשת דוח מפגש" subtitle="">
        <div className="vol-card vol-card-pad">
          <p style={{ color: "#b91c1c", fontWeight: 600 }}>
            לא נמצא פרופיל מתנדב מחובר לחשבון זה. יש לפנות למנהל.
          </p>
          {volError && <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>{volError}</p>}
        </div>
      </VolunteerLayout>
    );
  }

  const L = ({ icon: Icon, children }) => (
    <label><Icon size={15} />{children}</label>
  );

  return (
    <VolunteerLayout title="הגשת דוח מפגש" subtitle="מלאי דוח קצר לאחר כל מפגש התנדבות">
      <div className="vol-form-container">
        <div className="vol-card vol-card-pad">
          {sent && <div className="vol-alert-success">הדוח נשלח למנהל לבדיקה</div>}
          {submitError && <div className="vol-alert-error">{submitError}</div>}

          <form onSubmit={submit}>
            <div className="vol-form-grid">
              <div className="vol-field">
                <L icon={Calendar}>תאריך המפגש</L>
                <input className="input" type="date" value={form.date} onChange={set("date")} required />
              </div>
              <div className="vol-field">
                <L icon={Tag}>סוג המפגש</L>
                <select className="select" value={form.type} onChange={set("type")} required>
                  <option value="">בחר/י...</option>
                  {VOLUNTEER_REPORT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>

              <div className="vol-field col-span-full">
                <L icon={User}>שם מקבל השירות / שם הקשיש</L>
                <select className="select" value={form.elderlyId} onChange={set("elderlyId")} required disabled={elderlyLoading}>
                  <option value="">
                    {elderlyLoading
                      ? "טוען..."
                      : myElderly.length === 0
                        ? "אין אזרחים ותיקים משויכים אליך"
                        : "בחר/י אזרח ותיק..."}
                  </option>
                  {myElderly.map((e) => (
                    <option key={e.id} value={e.id}>{elderlyFullName(e)}</option>
                  ))}
                </select>
              </div>

              <div className="vol-field col-span-full">
                <L icon={MessageSquare}>תיאור המפגש</L>
                <textarea className="textarea" rows={5} value={form.notes} onChange={set("notes")} />
              </div>
            </div>

            <div className="vol-form-footer">
              <div className="vol-autosave"><Info size={14} /> יש למלא את הטופס ולשלוח</div>
              <div className="vol-form-actions">
                <button type="button" className="vol-btn vol-btn-outline" onClick={() => setForm(EMPTY_FORM)}>
                  ניקוי טופס
                </button>
                <button type="submit" className="vol-btn vol-btn-primary" disabled={submitting}>
                  <Send size={16} /> {submitting ? "שולח..." : "שליחת דוח"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </VolunteerLayout>
  );
}
