import { useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";

export default function VolunteerProfile() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "דניאלה כץ", phone: "052-1111111", email: "daniela@example.com",
    area: "גילה", availability: "בוקר, ערב", notes: "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <VolunteerLayout title="הפרטים שלי" subtitle="עדכון פרטי קשר בסיסיים">
      <div className="card">
        {saved && <div className="join-success" style={{ marginBottom: 16 }}>הפרטים נשמרו בהצלחה</div>}
        <form onSubmit={(e) => { e.preventDefault(); setSaved(true); }}>
          <div className="row row-2">
            <div className="field"><label>שם מלא</label><input className="input" value={form.name} onChange={set("name")} /></div>
            <div className="field"><label>טלפון</label><input className="input" value={form.phone} onChange={set("phone")} /></div>
            <div className="field"><label>אימייל</label><input className="input" type="email" value={form.email} onChange={set("email")} /></div>
            <div className="field"><label>אזור פעילות</label><input className="input" value={form.area} onChange={set("area")} /></div>
            <div className="field"><label>זמינות כללית</label><input className="input" value={form.availability} onChange={set("availability")} /></div>
          </div>
          <div className="field"><label>הערות</label><textarea className="textarea" rows={3} value={form.notes} onChange={set("notes")} /></div>
          <button type="submit" className="btn btn-primary">שמירת שינויים</button>
        </form>
      </div>
    </VolunteerLayout>
  );
}
