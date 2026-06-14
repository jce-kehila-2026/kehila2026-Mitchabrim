// src/admin/Reports.jsx
import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// خدمة التصدير (ستضاف لاحقاً)
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(","));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || "";
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }
  
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportToPDF = (elementId, filename) => {
  // سيتم إضافة مكتبة html2pdf لاحقاً
  alert("הורדת PDF תתווסף בהמשך");
};

// أنواع التقارير مع إعداداتها
const REPORT_TYPES = {
  elderly: {
    title: "דוח אזרחים ותיקים",
    icon: "👵",
    description: "פילוח לפי שכונה, אזור וסטטוס",
    fields: ["fullName", "address", "phone", "neighborhood", "status", "birthDate"],
    fieldLabels: {
      fullName: "שם מלא",
      address: "כתובת",
      phone: "טלפון",
      neighborhood: "שכונה",
      status: "סטטוס",
      birthDate: "תאריך לידה"
    }
  },
  volunteers: {
    title: "דוח מתנדבים",
    icon: "🤝",
    description: "סטטוס, קבוצות, שיבוצים",
    fields: ["fullName", "phone", "type", "group", "status", "startDate"],
    fieldLabels: {
      fullName: "שם מלא",
      phone: "טלפון",
      type: "סוג מתנדב",
      group: "קבוצה",
      status: "סטטוס",
      startDate: "תאריך התחלה"
    }
  },
  projects: {
    title: "דוח פרויקטים",
    icon: "🎁",
    description: "התקדמות, מסירות ובעיות",
    fields: ["projectName", "status", "packagesCount", "deliveredCount", "assignedCount"],
    fieldLabels: {
      projectName: "שם הפרויקט",
      status: "סטטוס",
      packagesCount: "מספר חבילות",
      deliveredCount: "נמסרו",
      assignedCount: "שובצו"
    }
  },
  parliaments: {
    title: "דוח פרלמנטים",
    icon: "🏛️",
    description: "השתתפות ונוכחות",
    fields: ["name", "location", "meetingDate", "participantsCount", "budget"],
    fieldLabels: {
      name: "שם הפרלמנט",
      location: "מיקום",
      meetingDate: "תאריך מפגש",
      participantsCount: "מספר משתתפים",
      budget: "תקציב"
    }
  },
  financial: {
    title: "דוח כספי",
    icon: "💰",
    description: "הכנסות, הוצאות ותרומות",
    fields: ["type", "amount", "date", "description", "receiptSent"],
    fieldLabels: {
      type: "סוג",
      amount: "סכום",
      date: "תאריך",
      description: "תיאור",
      receiptSent: "נשלחה קבלה"
    }
  },
  requests: {
    title: "דוח בקשות הצטרפות",
    icon: "✉️",
    description: "בקשות וטיפול",
    fields: ["fullName", "phone", "type", "status", "requestDate"],
    fieldLabels: {
      fullName: "שם מלא",
      phone: "טלפון",
      type: "סוג בקשה",
      status: "סטטוס",
      requestDate: "תאריך בקשה"
    }
  }
};

export default function Reports() {
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [statsData, setStatsData] = useState({
    elderlyByNeighborhood: [],
    volunteersByStatus: [],
    projectsProgress: []
  });

  // جلب البيانات الإحصائية
  useEffect(() => {
    fetchStatsData();
  }, []);

  const fetchStatsData = async () => {
    try {
      // بيانات تجريبية - سيتم استبدالها بجلب حقيقي من Firestore
      setStatsData({
        elderlyByNeighborhood: [
          { name: "רחביה", count: 42 },
          { name: "גילה", count: 51 },
          { name: "בית הכרם", count: 28 },
          { name: "פסגת זאב", count: 36 },
          { name: "קטמון", count: 24 }
        ],
        volunteersByStatus: [
          { status: "פעילים", count: 138 },
          { status: "ממתינים לשיבוץ", count: 12 },
          { status: "לא פעילים", count: 6 }
        ],
        projectsProgress: [
          { name: "חנוכה 2025", progress: 79 },
          { name: "פסח 2026", progress: 94 },
          { name: "ראש השנה 2026", progress: 0 }
        ]
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchReportData = async (reportType) => {
    setLoading(true);
    try {
      // بيانات تجريبية - سيتم استبدالها بجلب حقيقي من Firestore حسب نوع التقرير
      const mockData = {
        elderly: [
          { fullName: "משה כהן", address: "רחוב הרצל 1", phone: "0501234567", neighborhood: "רחביה", status: "פעיל", birthDate: "1945-03-15" },
          { fullName: "שרה לוי", address: "רחוב המלך 5", phone: "0502345678", neighborhood: "גילה", status: "פעיל", birthDate: "1950-07-22" },
          { fullName: "דוד בן ישי", address: "רחוב הפרחים 8", phone: "0503456789", neighborhood: "בית הכרם", status: "לא פעיל", birthDate: "1948-11-02" }
        ],
        volunteers: [
          { fullName: "יוסי ישראלי", phone: "0521234567", type: "סטודנט", group: "קבוצת צעירים", status: "פעיל", startDate: "2025-01-15" },
          { fullName: "רחל טל", phone: "0522345678", type: "עצמאי", group: "ללא קבוצה", status: "פעיל", startDate: "2025-02-20" }
        ],
        projects: [
          { projectName: "חנוכה 2025", status: "הסתיים", packagesCount: 150, deliveredCount: 142, assignedCount: 150 },
          { projectName: "פסח 2026", status: "פעיל", packagesCount: 200, deliveredCount: 87, assignedCount: 156 }
        ],
        parliaments: [
          { name: "פרלמנט רחביה", location: "בית הקפה רחביה", meetingDate: "2026-06-10", participantsCount: 18, budget: 350 },
          { name: "פרלמנט גילה", location: "המרכז הקהילתי גילה", meetingDate: "2026-06-12", participantsCount: 22, budget: 420 }
        ],
        financial: [
          { type: "תרומה", amount: 5000, date: "2026-06-01", description: "תרומה מעמותת ידידים", receiptSent: "כן" },
          { type: "הוצאה", amount: 1200, date: "2026-06-05", description: "קניית חבילות לפסח", receiptSent: "לא" }
        ],
        requests: [
          { fullName: "מרים לוי", phone: "0541234567", type: "התנדבות", status: "ממתין לטיפול", requestDate: "2026-06-10" }
        ]
      };
      
      setReportData(mockData[reportType] || []);
      setSelectedFields(REPORT_TYPES[reportType]?.fields || []);
    } catch (error) {
      console.error("Error fetching report data:", error);
      alert("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = (reportKey) => {
    setActiveReport(reportKey);
    fetchReportData(reportKey);
    setShowFieldSelector(false);
  };

  const handleExportCSV = () => {
    if (!reportData.length) return;
    
    const fields = selectedFields;
    const exportData = reportData.map(row => {
      const newRow = {};
      fields.forEach(field => {
        const label = REPORT_TYPES[activeReport]?.fieldLabels[field] || field;
        newRow[label] = row[field] || "";
      });
      return newRow;
    });
    
    exportToCSV(exportData, `${REPORT_TYPES[activeReport]?.title}_${new Date().toLocaleDateString("he-IL")}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleField = (field) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  // عرض قائمة التقارير (الصفحة الرئيسية)
  if (!activeReport) {
    return (
      <AdminLayout title="דוחות" subtitle="נתונים וסטטיסטיקות מהמערכת">
        {/* بطاقات التقارير */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
          {Object.entries(REPORT_TYPES).map(([key, report]) => (
            <div key={key} className="card" style={{ cursor: "pointer", transition: "transform 0.2s" }} onClick={() => handleOpenReport(key)}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{report.icon}</div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{report.title}</h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 16 }}>{report.description}</p>
              <button className="btn btn-primary" style={{ width: "100%" }}>פתיחת דוח</button>
            </div>
          ))}
        </div>

        {/* סטטיסטיקות מהירות */}
        <div className="row row-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <SectionCard title="אזרחים ותיקים לפי שכונה">
            {statsData.elderlyByNeighborhood.map((item) => (
              <div key={item.name} className="list-item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span>{item.name}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </SectionCard>
          <SectionCard title="מתנדבים לפי סטטוס">
            {statsData.volunteersByStatus.map((item) => (
              <div key={item.status} className="list-item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </SectionCard>
          <SectionCard title="פרויקטים לפי התקדמות">
            {statsData.projectsProgress.map((item) => (
              <div key={item.name} className="list-item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span>{item.name}</span>
                <strong>{item.progress}%</strong>
              </div>
            ))}
          </SectionCard>
        </div>
      </AdminLayout>
    );
  }

  // عرض بيانات التقرير المحدد
  const currentReport = REPORT_TYPES[activeReport];
  
  return (
    <AdminLayout 
      title={currentReport.title} 
      subtitle={currentReport.description}
      actions={
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-primary" onClick={() => setShowFieldSelector(!showFieldSelector)}>
            📋 בחירת שדות
          </button>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            📥 ייצוא ל-Excel
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ הדפסה
          </button>
          <button className="btn" onClick={() => setActiveReport(null)}>
            ⬅️ חזרה
          </button>
        </div>
      }
    >
      {/* בוחר שדות */}
      {showFieldSelector && (
        <SectionCard title="בחר את השדות שיופיעו בדוח">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            {currentReport.fields.map((field) => (
              <label key={field} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={() => toggleField(field)}
                />
                <span>{currentReport.fieldLabels[field] || field}</span>
              </label>
            ))}
          </div>
        </SectionCard>
      )}

      {/* טבלת הנתונים */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "50px" }}>טוען נתונים...</div>
      ) : reportData.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>אין נתונים להצגה</div>
      ) : (
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                {selectedFields.map((field) => (
                  <th key={field} style={{ padding: "12px", textAlign: "right" }}>
                    {currentReport.fieldLabels[field] || field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  {selectedFields.map((field) => (
                    <td key={field} style={{ padding: "10px" }}>
                      {field === "amount" ? `${row[field]} ₪` : (row[field] || "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* סיכום נתונים (לפי דרישת הלקוח) */}
      {reportData.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, backgroundColor: "#f9f9f9", borderRadius: 12 }}>
          <h4 style={{ marginBottom: 12 }}>סיכום</h4>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>📊 סה"כ רשומות: {reportData.length}</div>
            {activeReport === "elderly" && (
              <div>👥 סה"כ אזרחים ותיקים: {reportData.length}</div>
            )}
            {activeReport === "volunteers" && (
              <div>🤝 סה"כ מתנדבים: {reportData.length}</div>
            )}
            {activeReport === "financial" && (
              <>
                <div>💰 סה"כ הכנסות: {reportData.filter(r => r.type === "תרומה").reduce((s, r) => s + (r.amount || 0), 0)} ₪</div>
                <div>💸 סה"כ הוצאות: {reportData.filter(r => r.type === "הוצאה").reduce((s, r) => s + (r.amount || 0), 0)} ₪</div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}