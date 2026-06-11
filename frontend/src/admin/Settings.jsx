import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import {
  listAllowedUsers,
  inviteUser,
  updateAllowedUser,
  deleteAllowedUser,
  sendPasswordSetupEmail,
} from "@/services/allowedUsersService";

const ROLE_LABEL = { admin: "מנהל", volunteer: "מתנדב" };

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ displayName: "", email: "", role: "volunteer" });
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState("");

  const refresh = async () => {
    setLoading(true);
    const res = await listAllowedUsers();
    if (res.success) setUsers(res.users);
    else setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.email.trim() || !form.displayName.trim()) {
      setError("יש למלא שם ואימייל");
      return;
    }
    setSaving(true);
    const res = await inviteUser({ ...form, active: true });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "שגיאה בהוספת המשתמש");
      return;
    }
    setSuccess(res.message || "המשתמש נוסף ונשלחה אליו הודעה להגדרת סיסמה");
    setForm({ displayName: "", email: "", role: "volunteer" });
    refresh();
  };

  const handleResend = async (u) => {
    setError("");
    setSuccess("");
    setResendingId(u.id);
    const res = await sendPasswordSetupEmail(u.email);
    setResendingId("");
    if (res.success) setSuccess(res.message);
    else setError(res.error || "שגיאה בשליחת הקישור");
  };

  const handleToggleActive = async (u) => {
    await updateAllowedUser(u.id, { active: !u.active });
    refresh();
  };

  const handleChangeRole = async (u, role) => {
    await updateAllowedUser(u.id, { role });
    refresh();
  };

  const handleDelete = async (u) => {
    if (!confirm(`למחוק את ${u.displayName || u.email}?`)) return;
    await deleteAllowedUser(u.id);
    refresh();
  };

  return (
    <AdminLayout title="הגדרות" subtitle="ניהול הגדרות המערכת">
      <SectionCard title="פרטי הארגון">
        <div className="row row-2">
          <div className="field"><label>שם הארגון</label><input className="input" defaultValue="מתחברים" /></div>
          <div className="field"><label>כתובת</label><input className="input" defaultValue="ירושלים" /></div>
          <div className="field"><label>טלפון</label><input className="input" defaultValue="02-0000000" /></div>
          <div className="field"><label>אימייל</label><input className="input" defaultValue="info@mitchabrim.org" /></div>
        </div>
        <button className="btn btn-primary">שמירה</button>
      </SectionCard>

      <SectionCard title="משתמשי מערכת">
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 16 }}>
          ניהול המשתמשים המורשים להיכנס למערכת. רק משתמשים ברשימה זו יכולים להתחבר.
        </p>

        <form onSubmit={handleAdd} className="row row-4" style={{ alignItems: "end", marginBottom: 18 }}>
          <div className="field">
            <label>שם</label>
            <input
              className="input"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="שם מלא"
            />
          </div>
          <div className="field">
            <label>אימייל</label>
            <input
              className="input"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div className="field">
            <label>תפקיד</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="volunteer">מתנדב</option>
              <option value="admin">מנהל</option>
            </select>
          </div>
          <div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "מוסיף..." : "הוספת משתמש"}
            </button>
          </div>
        </form>

        {error && (
          <div style={{ background: "#fdecec", color: "#9b1c1c", padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 14 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: "#e8f5e9", color: "#1e6b2c", padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 14 }}>
            {success}
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--color-text-muted)" }}>טוען...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>אין משתמשים מורשים עדיין.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>אימייל</th>
                  <th>תפקיד</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName || "—"}</td>
                    <td dir="ltr" style={{ textAlign: "right" }}>{u.email}</td>
                    <td>
                      <select
                        className="input"
                        style={{ padding: "6px 10px" }}
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value)}
                      >
                        <option value="volunteer">מתנדב</option>
                        <option value="admin">מנהל</option>
                      </select>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: u.active ? "#e8f5e9" : "#fdecec",
                        color: u.active ? "#1e6b2c" : "#9b1c1c",
                      }}>
                        {u.active ? "פעיל" : "לא פעיל"}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn" onClick={() => handleToggleActive(u)}>
                        {u.active ? "השבת" : "הפעל"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => handleResend(u)}
                        disabled={resendingId === u.id || !u.email}
                        style={{ marginInlineStart: 6 }}
                        title="שליחת קישור להגדרת סיסמה מחדש"
                      >
                        {resendingId === u.id ? "שולח..." : "שלח קישור סיסמה"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => handleDelete(u)}
                        style={{ marginInlineStart: 6, color: "#9b1c1c" }}
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="אזורים ושכונות">
        <div className="row row-3">
          {[
            { area: "מרכז", n: ["רחביה", "קטמון", "טלביה"] },
            { area: "צפון", n: ["פסגת זאב", "רמות", "נווה יעקב"] },
            { area: "דרום", n: ["גילה", "ארנונה", "תלפיות"] },
            { area: "מערב", n: ["בית הכרם", "קריית יובל"] },
            { area: "מזרח", n: ["מעלות דפנה"] },
            { area: "מערב חדש", n: ["הר נוף"] },
            { area: "פסגות", n: ["מצפה נפתוח"] },
          ].map((a) => (
            <div key={a.area} className="card">
              <h4 style={{ fontSize: 15 }}>{a.area}</h4>
              <ul style={{ paddingInlineStart: 18, color: "var(--color-text-muted)", marginTop: 8 }}>
                {a.n.map((nb) => <li key={nb}>{nb}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="גיבוי נתונים">
        <p>גיבוי אחרון: 28.05.2026 • הצליח</p>
        <div style={{ marginTop: 12 }}><button className="btn btn-primary">הפעל גיבוי</button></div>
      </SectionCard>
    </AdminLayout>
  );
}
