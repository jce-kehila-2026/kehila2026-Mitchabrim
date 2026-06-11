import { useState } from "react";

export default function JoinRequestSection() {
  const [form, setForm] = useState({ fullName: "", phone: "", type: "", message: "" });
  const [sent, setSent] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.type) return;
    setSent(true);
    setForm({ fullName: "", phone: "", type: "", message: "" });
  };

  return (
    <section id="join" className="pub-section join-section">
      <div className="container join-grid">
        <div className="join-info">
          <span className="section-eyebrow">הצטרפות</span>
          <h2 className="section-title">רוצים להצטרף או לקבל פרטים?</h2>
          <p className="section-sub">השאירו פרטים ונחזור אליכם בהקדם ונשמח לעזור.</p>

          <ul className="join-points-clean">
            <li>
              <span className="jp-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </span>
              <div>
                <h5>ליווי אישי ויחס חם</h5>
                <p>צוות שמקשיב, מלווה ועונה בזמן לכל פנייה.</p>
              </div>
            </li>
            <li>
              <span className="jp-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="10" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div>
                <h5>שילוב במגוון פעילויות</h5>
                <p>התנדבות אישית, פרלמנטים, פרויקטי חגים ועוד.</p>
              </div>
            </li>
            <li>
              <span className="jp-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <div>
                <h5>תגובה תוך ימים ספורים</h5>
                <p>נחזור אליכם בתוך מספר ימי עבודה לעדכון הבא.</p>
              </div>
            </li>
          </ul>
        </div>

        <form className="join-card" onSubmit={submit}>
          {sent && <div className="join-success">הבקשה נשלחה בהצלחה. ניצור איתך קשר בהקדם.</div>}
          <div className="field">
            <label>שם מלא</label>
            <input className="input" value={form.fullName} onChange={update("fullName")} required />
          </div>
          <div className="field">
            <label>טלפון</label>
            <input className="input" type="tel" value={form.phone} onChange={update("phone")} required />
          </div>
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
          <div className="field">
            <label>הודעה קצרה</label>
            <textarea className="textarea" rows={4} value={form.message} onChange={update("message")} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block">שליחת פנייה</button>
          <p className="join-note">נחזור אליך בהקדם ונשמח לעזור.</p>
        </form>
      </div>
    </section>
  );
}
