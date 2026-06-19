import { useEffect, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

export default function VolunteerProfile() {
  const { volunteer, loading, error } = useCurrentVolunteer();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({ phone: "", address: "", email: "", notes: "" });

  useEffect(() => {
    if (volunteer) {
      setForm({
        phone: volunteer.phone || "",
        address: volunteer.address || "",
        email: volunteer.email || "",
        notes: volunteer.notes || "",
      });
    }
  }, [volunteer]);

  const fullName =
    volunteer?.name ||
    [volunteer?.firstName, volunteer?.lastName].filter(Boolean).join(" ") ||
    "";

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!volunteer?.id) return;
    try {
      setSaving(true);
      setSaveError("");
      const ref = doc(db, "volunteers", volunteer.id);
      await updateDoc(ref, {
        phone: form.phone,
        address: form.address,
        email: form.email,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (err) {
      console.error("update volunteer error:", err);
      setSaveError("שגיאה בשמירת הפרטים. נסי שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VolunteerLayout title="הפרטים שלי" subtitle="עדכון פרטי קשר בסיסיים">
      <div className="card">
        {loading && <p>טוען פרטים...</p>}
        {!loading && error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        {!loading && !error && volunteer && (
          <>
            {saved && <div className="join-success" style={{ marginBottom: 16 }}>הפרטים נשמרו בהצלחה</div>}
            {saveError && <div style={{ color: "#dc2626", marginBottom: 12 }}>{saveError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="row row-2">
                <div className="field">
                  <label>שם מלא</label>
                  <input className="input" value={fullName} readOnly disabled />
                </div>
                <div className="field">
                  <label>טלפון</label>
                  <input className="input" value={form.phone} onChange={set("phone")} />
                </div>
                <div className="field">
                  <label>כתובת</label>
                  <input className="input" value={form.address} onChange={set("address")} />
                </div>
                <div className="field">
                  <label>אימייל</label>
                  <input className="input" type="email" value={form.email} onChange={set("email")} />
                </div>
              </div>
              <div className="field">
                <label>הערות</label>
                <textarea className="textarea" rows={3} value={form.notes} readOnly disabled />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "שומר..." : "שמירת שינויים"}
              </button>
            </form>
          </>
        )}
      </div>
    </VolunteerLayout>
  );
}