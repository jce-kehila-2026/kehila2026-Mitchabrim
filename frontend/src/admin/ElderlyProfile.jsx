import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { getElderlyById } from "../services/elderlyService";
import { getElderlyContactById } from "../services/elderlyContactsService";

const Detail = ({ label, value }) => (
  <div className="item"><label>{label}</label><div>{value || "—"}</div></div>
);

const statusBadge = (s) => (s === "פעיל" ? "badge-green" : "badge-gray");

export default function ElderlyProfile() {
  const { id } = useParams();

  const [contact, setContact] = useState(null);
  const [loadingContact, setLoadingContact] = useState(true);

  const loadContact = async () => {
    try {
      setLoadingContact(true);
      // Read the elderly document to get its linked contactPersonId
      const elderly = await getElderlyById(id);
      const cpId = elderly?.contactPersonId || null;
      if (!cpId) {
        setContact(null);
        return;
      }
      const cp = await getElderlyContactById(cpId);
      setContact(cp);
    } catch (e) {
      console.error(e);
      setContact(null);
    } finally {
      setLoadingContact(false);
    }
  };

  useEffect(() => {
    loadContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <AdminLayout title="תיק אזרח ותיק" subtitle={`מספר תיק: ${id}`}>
      <Link to="/admin/elderly" className="back-link">→ חזרה לרשימה</Link>

      <SectionCard title="פרטים אישיים">
        <div className="detail-grid">
          <Detail label="שם מלא" value="מרים לוי" />
          <Detail label="ת.ז" value="012345678" />
          <Detail label="תאריך לידה" value="14.03.1942" />
          <Detail label="מצב משפחתי" value="אלמנה" />
        </div>
      </SectionCard>

      <SectionCard title="פרטי קשר">
        <div className="detail-grid">
          <Detail label="כתובת" value="הרצוג 12, רחביה" />
          <Detail label="שכונה" value="רחביה" />
          <Detail label="אזור" value="מרכז" />
          <Detail label="טלפון בית" value="02-5555555" />
          <Detail label="טלפון נייד" value="052-1234567" />
        </div>
      </SectionCard>

      <SectionCard
        title="איש קשר של האזרח"
        actions={
          <Link to="/admin/elderly" className="btn btn-sm">
            עריכת איש קשר מקושר
          </Link>
        }
      >
        {loadingContact ? (
          <p style={{ color: "#6b7280" }}>טוען איש קשר...</p>
        ) : !contact ? (
          <p style={{ color: "#6b7280" }}>לא קושר איש קשר</p>
        ) : (
          <>
            <div className="detail-grid">
              <Detail label="שם איש קשר" value={contact.fullName} />
              <Detail label="סוג קשר" value={contact.relationType} />
              <Detail label="טלפון" value={contact.phone} />
              <Detail label="מייל" value={contact.email} />
              <Detail
                label="סטטוס"
                value={
                  <span className={`badge ${statusBadge(contact.status)}`}>
                    {contact.status || "פעיל"}
                  </span>
                }
              />
            </div>
            {contact.notes && (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontWeight: 600 }}>הערות</label>
                <p style={{ margin: "4px 0 0", color: "#374151" }}>{contact.notes}</p>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="רקע וצרכים">
        <div className="detail-grid">
          <Detail label="ארץ לידה" value="פולין" />
          <Detail label="שפת דיבור" value="עברית, יידיש" />
          <Detail label="הגדרה דתית" value="מסורתית" />
          <Detail label="סיוע נדרש" value="קשר חברתי, ליווי לרופא" />
        </div>
      </SectionCard>

      <SectionCard title="התנדבות">
        <div className="detail-grid">
          <Detail label="סטטוס" value={<span className="badge badge-green">מחובר</span>} />
          <Detail label="מתנדבת משויכת" value="דניאלה כץ" />
          <Detail label="תאריך התחלה" value="01.06.2024" />
        </div>
      </SectionCard>

      <SectionCard title="היסטוריית פרויקטי חגים">
        <div className="list-item">
          <div><div className="list-item-title">חלוקת חבילות חנוכה 2025</div>
          <div className="list-item-sub">קיבלה • נמסר על ידי: דניאלה כץ</div></div>
          <span className="badge badge-green">נמסר</span>
        </div>
      </SectionCard>

      <SectionCard title="הערות פנימיות">
        <p>קשר חם מאוד עם המתנדבת. מבקשת קשר טלפוני יומי. לתאם מראש לפני ביקור.</p>
      </SectionCard>
    </AdminLayout>
  );
}
