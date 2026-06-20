import { useEffect, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";
import { User, Phone, MapPin, Mail, MessageSquare, Save, UserCircle2 } from "lucide-react";

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

  const L = ({ icon: Icon, children }) => (
    <label><Icon size={15} />{children}</label>
  );

  return (
    <VolunteerLayout title="" subtitle="">
      <div className="vol-profile-container">
        {loading && <div className="vol-card vol-card-pad"><p>טוען פרטים...</p></div>}
        {!loading && error && <div className="vol-alert-error">{error}</div>}
        {!loading && !error && volunteer && (
          <div className="vol-profile-card">
            <div className="vol-profile-head">
              <div className="text">
                <h2>הפרופיל שלי</h2>
                <p>עדכון פרטי קשר בסיסיים</p>
              </div>
              <div className="avatar"><UserCircle2 size={36} /></div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="vol-profile-body">
                {saved && <div className="vol-alert-success">הפרטים נשמרו בהצלחה</div>}
                {saveError && <div className="vol-alert-error">{saveError}</div>}

                <div className="vol-form-grid">
                  <div className="vol-field">
                    <L icon={Phone}>טלפון</L>
                    <input className="input" value={form.phone} onChange={set("phone")} />
                  </div>
                  <div className="vol-field">
                    <L icon={User}>שם מלא</L>
                    <input className="input" value={fullName} readOnly disabled />
                  </div>
                  <div className="vol-field">
                    <L icon={MapPin}>כתובת</L>
                    <input className="input" value={form.address} onChange={set("address")} />
                  </div>
                  <div className="vol-field">
                    <L icon={Mail}>אימייל</L>
                    <input className="input" type="email" value={form.email} onChange={set("email")} />
                  </div>
                  <div className="vol-field col-span-full">
                    <L icon={MessageSquare}>הערות</L>
                    <textarea className="textarea" rows={3} value={form.notes} readOnly disabled />
                  </div>
                </div>
              </div>

              <div className="vol-profile-foot">
                <button type="button" className="vol-btn vol-btn-outline" onClick={() => volunteer && setForm({
                  phone: volunteer.phone || "",
                  address: volunteer.address || "",
                  email: volunteer.email || "",
                  notes: volunteer.notes || "",
                })}>
                  ביטול
                </button>
                <button type="submit" className="vol-btn vol-btn-primary" disabled={saving}>
                  <Save size={16} /> {saving ? "שומר..." : "שמירת שינויים"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </VolunteerLayout>
  );
}