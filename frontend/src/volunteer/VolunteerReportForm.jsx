import { useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";

const ELDERLY = ["מרים לוי", "יוסף ברקוביץ", "חנה שטרן"];

export default function VolunteerReportForm() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    date: "", type: "", elderly: "", held: "", duration: "", condition: "", needs: "", problem: "", notes: "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <VolunteerLayout title="הגשת דוח מפגש" subtitle="מלאי דוח קצר לאחר כל מפגש התנדבות">
      <div className="card">
        {sent && <div className="join-success" style={{ marginBottom: 16 }}>הדוח נשלח בהצלחה לבדיקה</div>}
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
          <div className="field"><label>עם מי התקיים המפגש</label>
            <select className="select" value={form.elderly} onChange={set("elderly")} required>
              <option value="">בחר/י אזרח ותיק...</option>
              {ELDERLY.map((e) => <option key={e}>{e}</option>)}
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
          <button type="submit" className="btn btn-primary">שליחת דוח</button>
        </form>
      </div>
    </VolunteerLayout>
  );
}
