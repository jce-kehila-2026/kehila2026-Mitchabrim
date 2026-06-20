import { useEffect, useMemo, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer.js";
import { getElderly } from "@/services/elderlyService.js";
import { createVolunteerReport } from "@/services/reportsService.js";
import { useAuth } from "@/context/AuthContext.jsx";

const EMPTY_FORM = {
  date: "",
  type: "",
  elderlyId: "",
  held: "",
  duration: "",
  condition: "",
  needs: "",
  problem: "",
  notes: "",
};

const volunteerFullName = (v) =>
  v?.fullName ||
  v?.name ||
  [v?.firstName, v?.lastName].filter(Boolean).join(" ").trim() ||
  v?.email ||
  "";

const elderlyFullName = (e) =>
  e?.fullName ||
  e?.name ||
  [e?.firstName, e?.lastName].filter(Boolean).join(" ").trim() ||
  "—";

export default function VolunteerReportForm() {
  const { user } = useAuth();
  const { volunteer, loading: volLoading, linked, error: volError } = useCurrentVolunteer();

  const [allElderly, setAllElderly] = useState([]);
  const [elderlyLoading, setElderlyLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setElderlyLoading(true);
        const list = await getElderly();
        if (!cancelled) setAllElderly(list);
      } catch (err) {
        console.error("Failed to load elderly:", err);
      } finally {
        if (!cancelled) setElderlyLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only elderly assigned to this volunteer (matching by volId or fallback to elderlyIds array on volunteer)
  const myElderly = useMemo(() => {
    if (!volunteer) return [];
    const idsFromVolunteer = Array.isArray(volunteer.elderlyIds) ? volunteer.elderlyIds : [];
    return allElderly.filter((e) => {
      if (idsFromVolunteer.includes(e.id)) return true;
      if (e.volId && e.volId === volunteer.id) return true;
      if (e.assignedVolunteerId && e.assignedVolunteerId === volunteer.id) return true;
      return false;
    });
  }, [allElderly, volunteer]);

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!linked || !volunteer) return;
    setSubmitError("");

    const selectedElderly = myElderly.find((el) => el.id === form.elderlyId);
    if (!selectedElderly) {
      setSubmitError("יש לבחור אזרח ותיק מהרשימה");
      return;
    }

    const reportPayload = {
      volunteerId: volunteer.id,
      volunteerAuthUid: user?.uid || null,
      volunteerName: volunteerFullName(volunteer),
      volunteerEmail: user?.email || null,
      elderlyId: selectedElderly.id,
      elderlyName: elderlyFullName(selectedElderly),
      reportDate: form.date,
      reportType: form.type,
      meetingDuration: form.duration,
      wasMeetingHeld: form.held,
      generalStatusAfterMeeting: form.condition,
      needsFollowUp: form.needs,
      problemType: form.problem,
      notes: form.notes,
    };

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
        <div className="card"><p>טוען נתוני מתנדב...</p></div>
      </VolunteerLayout>
    );
  }

  if (!linked) {
    return (
      <VolunteerLayout title="הגשת דוח מפגש" subtitle="">
        <div className="card">
          <p style={{ color: "#b91c1c", fontWeight: 600 }}>
            לא נמצא פרופיל מתנדב מחובר לחשבון זה. יש לפנות למנהל.
          </p>
          {volError && <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>{volError}</p>}
        </div>
      </VolunteerLayout>
    );
  }

  return (
    <VolunteerLayout title="הגשת דוח מפגש" subtitle="מלאי דוח קצר לאחר כל מפגש התנדבות">
      <div className="card">
        {sent && (
          <div className="join-success" style={{ marginBottom: 16 }}>
            הדוח נשלח למנהל לבדיקה
          </div>
        )}
        {submitError && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 6, marginBottom: 12 }}>
            {submitError}
          </div>
        )}
        <form onSubmit={submit}>
          <div className="row row-2">
            <div className="field"><label>תאריך המפגש</label><input className="input" type="date" value={form.date} onChange={set("date")} required /></div>
            <div className="field"><label>סוג המפגש</label>
              <select className="select" value={form.type} onChange={set("type")} required>
                <option value="">בחר/י...</option>
                <option>ביקור בית</option><option>שיחת טלפון</option><option>ליווי</option>
                <option>חלוקת חבילה</option><option>מפגש פרלמנט</option><option>אחר</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>שם מקבל השירות / שם הקשיש</label>
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
          <div className="row row-2">
            <div className="field"><label>האם המפגש התקיים</label>
              <select className="select" value={form.held} onChange={set("held")} required>
                <option value="">בחר/י...</option>
                <option>התקיים</option><option>לא התקיים</option><option>נדחה</option>
                <option>לא היה מענה</option><option>האזרח הוותיק לא היה בבית</option>
              </select>
            </div>
            <div className="field"><label>משך המפגש</label>
              <select className="select" value={form.duration} onChange={set("duration")}>
                <option value="">בחר/י...</option>
                <option>עד 30 דקות</option><option>30-60 דקות</option><option>יותר משעה</option>
              </select>
            </div>
          </div>
          <div className="field"><label>מצב כללי של האזרח הוותיק</label>
            <select className="select" value={form.condition} onChange={set("condition")}>
              <option value="">בחר/י...</option>
              <option>טוב</option><option>רגיל</option><option>צריך מעקב</option><option>דחוף לפנות לרכזת</option>
            </select>
          </div>
          <div className="row row-2">
            <div className="field"><label>האם נדרשת התערבות רכזת</label>
              <select className="select" value={form.needs} onChange={set("needs")}>
                <option value="">בחר/י...</option>
                <option>כן</option><option>לא</option>
              </select>
            </div>
            <div className="field"><label>סוג הבעיה</label>
              <select className="select" value={form.problem} onChange={set("problem")}>
                <option value="">בחר/י...</option>
                <option>אין בעיה</option><option>בעיה בריאותית כללית</option><option>קושי רגשי / בדידות</option>
                <option>בעיה לוגיסטית</option><option>לא היה מענה</option><option>פרטי קשר לא נכונים</option><option>אחר</option>
              </select>
            </div>
          </div>
          <div className="field"><label>הערות נוספות</label><textarea className="textarea" rows={4} value={form.notes} onChange={set("notes")} /></div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "שולח..." : "שליחת דוח"}
          </button>
        </form>
      </div>
    </VolunteerLayout>
  );
}