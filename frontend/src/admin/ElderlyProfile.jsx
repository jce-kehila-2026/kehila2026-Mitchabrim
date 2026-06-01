import { Link, useParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

const Detail = ({ label, value }) => (
  <div className="item"><label>{label}</label><div>{value || "—"}</div></div>
);

export default function ElderlyProfile() {
  const { id } = useParams();
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

      <SectionCard title="איש קשר">
        <div className="detail-grid">
          <Detail label="שם איש קשר" value="דוד לוי (בן)" />
          <Detail label="טלפון" value="054-9999999" />
        </div>
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

      <SectionCard title="השתתפות בפרלמנט">
        <div className="detail-grid">
          <Detail label="פרלמנט" value="פרלמנט רחביה" />
          <Detail label="מפגש אחרון" value="20.05.2026" />
        </div>
      </SectionCard>

      <SectionCard title="היסטוריית פרויקטי חגים">
        <div className="list-item">
          <div><div className="list-item-title">חלוקת חבילות חנוכה 2025</div>
          <div className="list-item-sub">קיבלה • נמסר על ידי: דניאלה כץ</div></div>
          <span className="badge badge-green">נמסר</span>
        </div>
        <div className="list-item">
          <div><div className="list-item-title">שי לפסח 2025</div>
          <div className="list-item-sub">קיבלה • נמסר על ידי: חברת חשמל</div></div>
          <span className="badge badge-green">נמסר</span>
        </div>
      </SectionCard>

      <SectionCard title="הערות פנימיות">
        <p>קשר חם מאוד עם המתנדבת. מבקשת קשר טלפוני יומי. לתאם מראש לפני ביקור.</p>
      </SectionCard>
    </AdminLayout>
  );
}
