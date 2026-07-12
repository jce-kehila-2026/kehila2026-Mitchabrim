import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { auth } from "../firebase";
import { getUserByEmail, updateUserProfileFields } from "../services/usersService";

function fmt(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("he-IL");
  } catch {
    return "—";
  }
}

export default function AdminProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const [data, setData] = useState({
    docId: null, email: "", fullName: "", phoneNumber: "",
    role: "מנהל מערכת", status: "פעיל", createdAt: null, updatedAt: null,
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) { setLoading(false); return; }
      try {
        const rec = await getUserByEmail(u.email);
        setData({
          docId: rec?.id || u.uid,
          email: u.email || "",
          fullName: rec?.fullName || rec?.displayName || u.displayName || "",
          phoneNumber: rec?.phoneNumber || "",
          role: "מנהל מערכת",
          status: rec?.status || "פעיל",
          createdAt: rec?.createdAt || null,
          updatedAt: rec?.updatedAt || null,
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, []);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const save = async (e) => {
    e.preventDefault();
    if (!data.docId) return;
    setSaving(true);
    try {
      const now = await updateUserProfileFields(data.docId, {
        fullName: data.fullName, phoneNumber: data.phoneNumber,
      });
      setData((p) => ({ ...p, updatedAt: now }));
      setEditing(false);
      showToast("הפרופיל נשמר בהצלחה");
    } catch {
      showToast("שגיאה בשמירת הפרופיל");
    } finally {
      setSaving(false);
    }
  };

  const initial = (data.fullName || data.email || "מ").charAt(0).toUpperCase();

  const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2d8c9", outline: "none", fontFamily: "inherit", fontSize: 14, background: "#fff", direction: "rtl" };
  const label = { display: "block", fontSize: 12, fontWeight: 700, color: "#7a5a4a", marginBottom: 6 };

  return (
    <AdminPageLayout heroImage="/admin-heroes/setting_hero.png" title="פרופיל אישי" subtitle="פרטי חשבון המנהל המחובר">
      {toast && (<div className="admin-toast"><span className="admin-toast-check">✓</span>{toast}</div>)}

      <SectionCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6c757d" }}>טוען...</div>
        ) : (
          <div style={{ direction: "rtl" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #f0e6d6" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#8b2c2c,#a64d4d)", color: "#fff", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 800, boxShadow: "0 6px 20px rgba(139,44,44,.25)" }}>{initial}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#3c2a1e" }}>{data.fullName || "מנהל"}</div>
                <div style={{ fontSize: 13, color: "#6c757d" }}>{data.email}</div>
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "#fdecec", color: "#8b2c2c", fontSize: 12, fontWeight: 700 }}>{data.role}</div>
              </div>
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 10 }}>
                <button onClick={() => navigate(-1)} style={{ padding: "9px 18px", borderRadius: 10, background: "#fff", border: "1px solid #e2d8c9", color: "#495057", fontWeight: 700, cursor: "pointer" }}>חזרה</button>
                {!editing && (
                  <button onClick={() => setEditing(true)} style={{ padding: "9px 18px", borderRadius: 10, background: "#8b2c2c", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>עריכת פרופיל</button>
                )}
              </div>
            </div>

            {editing ? (
              <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><label style={label}>שם מלא</label><input style={input} value={data.fullName} onChange={(e) => setData({ ...data, fullName: e.target.value })} required /></div>
                <div><label style={label}>טלפון</label><input style={input} value={data.phoneNumber} onChange={(e) => setData({ ...data, phoneNumber: e.target.value })} type="tel" /></div>
                <div><label style={label}>אימייל</label><input style={{ ...input, background: "#f5ece0" }} value={data.email} disabled dir="ltr" /></div>
                <div><label style={label}>תפקיד</label><input style={{ ...input, background: "#f5ece0" }} value={data.role} disabled /></div>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                  <button type="button" onClick={() => setEditing(false)} disabled={saving} style={{ padding: "10px 22px", borderRadius: 10, background: "#fff", border: "1.5px solid #8b2c2c", color: "#8b2c2c", fontWeight: 700, cursor: "pointer" }}>ביטול</button>
                  <button type="submit" disabled={saving} style={{ padding: "10px 22px", borderRadius: 10, background: "#8b2c2c", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", opacity: saving ? .7 : 1 }}>{saving ? "שומר..." : "שמירת שינויים"}</button>
                </div>
              </form>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                {[
                  ["שם מלא", data.fullName || "—"],
                  ["טלפון", data.phoneNumber || "—"],
                  ["אימייל", data.email || "—"],
                  ["תפקיד", data.role],
                  ["סטטוס חשבון", data.status],
                  ["נוצר בתאריך", fmt(data.createdAt)],
                  ["עדכון אחרון", fmt(data.updatedAt)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: "#fdfbf7", border: "1px solid #f0e6d6", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#9e8a7a", fontWeight: 700, marginBottom: 5 }}>{k}</div>
                    <div style={{ fontSize: 14, color: "#3c2a1e", fontWeight: 700, wordBreak: "break-word" }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </AdminPageLayout>
  );
}
