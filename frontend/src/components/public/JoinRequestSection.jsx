import { useState } from "react";

export default function JoinRequestSection() {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", type: "", reason: "" });
  const [sent, setSent] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.phone || !form.type) return;
    setSent(true);
    setForm({ firstName: "", lastName: "", phone: "", type: "", reason: "" });
  };

  return (
    <section id="join" className="pub-section join">
      <div className="container" style={{ maxWidth: 760 }}>
        <span className="section-eyebrow">הצטרפות</span>
        <h2 className="section-title">הצטרפות והשארת פרטים</h2>
        <p className="section-sub">נשמח ליצור איתך קשר ולספר יותר על הפרויקט.</p>
        <form className="join-card" onSubmit={submit}>
          {sent && <div className="join-success">הפרטים נשלחו בהצלחה. נחזור אליך בהקדם.</div>}
          <div className="row row-2">
            <div className="field"><label>שם</label><input className="input" value={form.firstName} onChange={update("firstName")} required /></div>
            <div className="field"><label>משפחה</label><input className="input" value={form.lastName} onChange={update("lastName")} required /></div>
          </div>
          <div className="field"><label>טלפון</label><input className="input" type="tel" value={form.phone} onChange={update("phone")} required /></div>
          <div className="field">
            <label>סוג פנייה</label>
            <select className="select" value={form.type} onChange={update("type")} required>
              <option value="">בחר/י סוג פנייה...</option>
              <option>אזרח ותיק</option>
              <option>פונה עבור אזרח ותיק אחר</option>
              <option>מתעניין בהתנדבות</option>
              <option>איש מקצוע</option>
              <option>אחר</option>
            </select>
          </div>
          <div className="field"><label>סיבת הפניה</label><textarea className="textarea" rows={4} value={form.reason} onChange={update("reason")} /></div>
          <button type="submit" className="btn btn-primary">שליחת פרטים</button>
        </form>
      </div>
    </section>
  );
}
