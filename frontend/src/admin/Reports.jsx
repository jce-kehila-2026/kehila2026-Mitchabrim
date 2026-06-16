// src/admin/Reports.jsx
import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { PROJECTS as PROJECTS_SEED } from "./Projects.jsx";
import { ELDERLY_SEED } from "./Elderly.jsx";
import { REQUESTS as JOIN_REQUESTS_SEED } from "./Dashboard.jsx";

/* ============================================================
   Seed adapters — map page-level sample data into report rows
   so reports stay populated when Firestore is empty.
   ============================================================ */
const SEED_DATA = {
  projects: PROJECTS_SEED.map((p) => ({
    id: p.id,
    name: p.name,
    holiday: p.holiday,
    startDate: p.date,
    endDate: p.date,
    status: p.status,
    progress: p.elderly ? Math.round((p.delivered / p.elderly) * 100) : 0,
    deliveries: `${p.delivered}/${p.elderly}`,
    notes: p.issues ? `${p.issues} בעיות פתוחות` : "",
  })),
  elderly: ELDERLY_SEED,
  joinRequests: JOIN_REQUESTS_SEED.map((r, i) => ({
    id: i + 1,
    fullName: r.name,
    phone: "",
    email: "",
    type: r.note,
    status: "חדש",
    createdAt: new Date().toLocaleDateString("he-IL"),
    notes: r.note,
  })),
};

/* Fallback financial sample data (used when collection is empty) */
const FINANCIAL_SEED = [
  { id: "f1", type: "תרומה", subType: "העברה בבית",                 name: "משפחת לוי",        amount: 1500, date: "10.12.2025", project: "חנוכה 2025", receiptType: "קבלה 46", receiptSent: "כן" },
  { id: "f2", type: "תרומה", subType: "העברה במזומן",               name: "תורם אנונימי",     amount: 800,  date: "11.12.2025", project: "חנוכה 2025", receiptType: "קבלה רגילה", receiptSent: "כן" },
  { id: "f3", type: "תרומה", subType: "העברה מ.מנהל קהילתי גילה",  name: "מנהל קהילתי גילה", amount: 5000, date: "12.12.2025", project: "חנוכה 2025", receiptType: "קבלה 46", receiptSent: "כן" },
  { id: "f4", type: "תרומה", subType: "העברה בבית",                 name: "משפחת כהן",        amount: 2200, date: "01.03.2026", project: "פסח 2026",   receiptType: "קבלה 46", receiptSent: "לא" },
  { id: "f5", type: "הוצאה", subType: "",                            name: "ספק חבילות",        amount: 3200, date: "12.12.2025", project: "חנוכה 2025" },
  { id: "f6", type: "הוצאה", subType: "",                            name: "תחבורה ולוגיסטיקה", amount: 1800, date: "02.03.2026", project: "פסח 2026" },
];
SEED_DATA.financial = FINANCIAL_SEED;

/* ============================================================
   1. Report definitions (6 cards)
   ============================================================ */
const REPORT_TYPES = {
  projects: {
    id: "projects",
    icon: "🎁",
    label: "דוח פרויקטים",
    description: "התקדמות, מסירות ובעיות",
    collection: "projects",
    fields: [
      { key: "name", label: "שם הפרויקט" },
      { key: "holiday", label: "חג" },
      { key: "startDate", label: "תאריך התחלה" },
      { key: "endDate", label: "תאריך סיום" },
      { key: "status", label: "סטטוס" },
      { key: "progress", label: "התקדמות (%)" },
      { key: "deliveries", label: "מסירות" },
      { key: "notes", label: "הערות" },
    ],
    defaults: ["name", "holiday", "startDate", "status", "progress"],
    filters: [
      { key: "holiday", label: "חג" },
      { key: "status", label: "סטטוס" },
    ],
  },
  volunteers: {
    id: "volunteers",
    icon: "🤝",
    label: "דוח מתנדבים",
    description: "סטטוס, קבוצות, שיבוצים",
    collection: "volunteers",
    fields: [
      { key: "fullName", label: "שם מלא" },
      { key: "phone", label: "טלפון" },
      { key: "email", label: "אימייל" },
      { key: "group", label: "קבוצה" },
      { key: "groupRole", label: "תפקיד" },
      { key: "status", label: "סטטוס" },
      { key: "neighborhood", label: "שכונה" },
      { key: "assignedTo", label: "משויך לאזרח" },
      { key: "startDate", label: "תאריך התחלה" },
      { key: "notes", label: "הערות" },
    ],
    defaults: ["fullName", "phone", "group", "status", "assignedTo"],
    filters: [
      { key: "group", label: "קבוצה" },
      { key: "status", label: "סטטוס" },
    ],
  },
  elderly: {
    id: "elderly",
    icon: "👵",
    label: "דוח אזרחים ותיקים",
    description: "פילוח לפי שכונה, אזור וסטטוס",
    collection: "elderly",
    fields: [
      { key: "fullName", label: "שם מלא" },
      { key: "gender", label: "מגדר" },
      { key: "idNum", label: "ת.ז" },
      { key: "address", label: "כתובת" },
      { key: "neighborhood", label: "שכונה" },
      { key: "area", label: "אזור" },
      { key: "mobile", label: "טלפון נייד" },
      { key: "homePhone", label: "טלפון בית" },
      { key: "birth", label: "ת.לידה" },
      { key: "status", label: "סטטוס" },
      { key: "volStatus", label: "סטטוס מתנדב" },
      { key: "volName", label: "מתנדב משויך" },
      { key: "contactName", label: "איש קשר" },
      { key: "contactPhone", label: "טל' איש קשר" },
      { key: "lastContact", label: "תאריך יצירת קשר אחרון" },
      { key: "parliament", label: "פרלמנט" },
      { key: "notes", label: "הערות נוספות" },
    ],
    defaults: ["fullName", "gender", "address", "mobile", "idNum", "lastContact", "volStatus", "contactPhone", "notes", "birth"],
    filters: [
      { key: "neighborhood", label: "שכונה" },
      { key: "area", label: "אזור" },
      { key: "status", label: "סטטוס" },
      { key: "parliament", label: "פרלמנט" },
    ],
  },
  joinRequests: {
    id: "joinRequests",
    icon: "✉️",
    label: "דוח בקשות הצטרפות",
    description: "בקשות וטיפול",
    collection: "joinRequests",
    fields: [
      { key: "fullName", label: "שם מלא" },
      { key: "phone", label: "טלפון" },
      { key: "email", label: "אימייל" },
      { key: "type", label: "סוג בקשה" },
      { key: "status", label: "סטטוס" },
      { key: "createdAt", label: "תאריך בקשה" },
      { key: "notes", label: "הערות" },
    ],
    defaults: ["fullName", "phone", "type", "status", "createdAt"],
    filters: [
      { key: "type", label: "סוג בקשה" },
      { key: "status", label: "סטטוס" },
    ],
  },
  financial: {
    id: "financial",
    icon: "💰",
    label: "דוח כספי",
    description: "כללי / סיכום לפי חג / סיכום תרומות",
    collection: "financial",
    fields: [
      { key: "type", label: "סוג" },
      { key: "subType", label: "תת-סוג" },
      { key: "name", label: "שם" },
      { key: "amount", label: "סכום (₪)" },
      { key: "date", label: "תאריך" },
      { key: "project", label: "פרויקט" },
      { key: "receiptType", label: "סוג קבלה" },
      { key: "receiptSent", label: "נשלחה קבלה" },
      { key: "notes", label: "הערות" },
    ],
    defaults: ["type", "name", "amount", "date", "project"],
    filters: [
      { key: "type", label: "סוג" },
      { key: "project", label: "פרויקט" },
    ],
  },
  parliaments: {
    id: "parliaments",
    icon: "🏛️",
    label: "דוח פרלמנטים",
    description: "השתתפות ונוכחות",
    collection: "parliaments",
    fields: [
      { key: "name", label: "שם הפרלמנט" },
      { key: "location", label: "מיקום" },
      { key: "meetingDate", label: "תאריך מפגש" },
      { key: "meetingNumber", label: "מספר מפגש" },
      { key: "participants", label: "משתתפים" },
      { key: "confirmed", label: "אישרו הגעה" },
      { key: "notComing", label: "לא יגיעו" },
      { key: "budget", label: "תקציב (₪)" },
      { key: "notes", label: "הערות" },
    ],
    defaults: ["name", "location", "meetingDate", "participants", "confirmed"],
    filters: [
      { key: "name", label: "פרלמנט" },
    ],
  },
};

/* ============================================================
   2. PDF Export function - fixed
   ============================================================ */
const exportToPDF = (report, rows, fields, filters) => {
  if (!rows.length) {
    alert("אין נתונים לייצוא");
    return;
  }
  
  const cols = fields.map((k) => report.fields.find((f) => f.key === k)).filter(Boolean);
  const today = new Date().toLocaleDateString("he-IL");
  
  // Build filter chips string
  let filterChips = "";
  const activeFilters = Object.entries(filters).filter(([, v]) => v);
  if (activeFilters.length > 0) {
    filterChips = activeFilters
      .map(([k, v]) => {
        const label = report.filters.find((f) => f.key === k)?.label || k;
        return `${label}: ${v}`;
      })
      .join(" • ");
  }

  // Build table rows
  const tableRows = rows.map((r) => {
    return `<tr>${cols.map((c) => `<td>${r[c.key] == null || r[c.key] === "" ? "—" : String(r[c.key])}</td>`).join("")}</tr>`;
  }).join("");

  // Build summary stats
  let summaryItems = `<div class="item">📊 סה"כ רשומות: <strong>${rows.length}</strong></div>`;
  
  if (report.id === "elderly") {
    const males = rows.filter(d => d.gender === "זכר").length;
    const females = rows.filter(d => d.gender === "נקבה").length;
    const active = rows.filter(d => d.status === "פעיל").length;
    summaryItems += `
      <div class="item">👴 זכרים: <strong>${males}</strong></div>
      <div class="item">👵 נקבות: <strong>${females}</strong></div>
      <div class="item">🟢 פעילים: <strong>${active}</strong></div>
    `;
  } else if (report.id === "volunteers") {
    const active = rows.filter(d => d.status === "פעיל").length;
    const pending = rows.filter(d => d.status === "ממתין לשיבוץ").length;
    summaryItems += `
      <div class="item">🟢 פעילים: <strong>${active}</strong></div>
      <div class="item">⏳ ממתינים: <strong>${pending}</strong></div>
    `;
  } else if (report.id === "parliaments") {
    const totalParticipants = rows.reduce((s, r) => s + (r.participants || 0), 0);
    const totalBudget = rows.reduce((s, r) => s + (r.budget || 0), 0);
    summaryItems += `
      <div class="item">🏛️ מפגשים: <strong>${rows.length}</strong></div>
      <div class="item">👥 משתתפים: <strong>${totalParticipants}</strong></div>
      <div class="item">💰 תקציב: <strong>₪${totalBudget}</strong></div>
    `;
  } else if (report.id === "financial") {
    const incomes = rows.filter(d => d.type === "תרומה" || d.type === "הכנסה");
    const expenses = rows.filter(d => d.type === "הוצאה");
    const totalIn = incomes.reduce((s, r) => s + (r.amount || 0), 0);
    const totalOut = expenses.reduce((s, r) => s + (r.amount || 0), 0);
    summaryItems += `
      <div class="item">💰 הכנסות: <strong>₪${totalIn}</strong></div>
      <div class="item">💸 הוצאות: <strong>₪${totalOut}</strong></div>
      <div class="item">📊 יתרה: <strong>₪${totalIn - totalOut}</strong></div>
    `;
  }

  const html = `<!doctype html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${report.label}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Arial", "David", "Segoe UI", sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background: white;
    }
    .date-top {
      text-align: left;
      font-size: 13px;
      color: #555;
      margin-bottom: 6px;
      border-bottom: 2px solid #8B0000;
      padding-bottom: 6px;
    }
    .main-title {
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      color: #8B0000;
      margin: 8px 0 2px;
      text-decoration: underline;
    }
    .sub-title {
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: #8B0000;
      margin: 0 0 16px;
      text-decoration: underline;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #8B0000;
      color: white;
      padding: 10px 8px;
      text-align: right;
      border: 1px solid #6b0000;
      font-weight: 600;
    }
    td {
      padding: 8px;
      border: 1px solid #bbb;
      text-align: right;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td {
      background: #f9f6f4;
    }
    .filter-info {
      font-size: 12px;
      color: #666;
      margin: 6px 0 14px;
      padding: 6px 12px;
      background: #f5f5f5;
      border-radius: 6px;
    }
    .summary-row {
      margin-top: 16px;
      padding: 12px 16px;
      background: #f5f0ed;
      border: 1px solid #ddd;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 20px;
    }
    .summary-row .item {
      font-size: 14px;
    }
    .summary-row .item strong {
      color: #8B0000;
    }
    @media print {
      .noprint { display: none; }
    }
  </style>
</head>
<body>
  <div class="date-top">📅 ${today}</div>
  <div class="main-title">פרויקט מתחברים</div>
  <div class="sub-title">${report.label}</div>
  ${filterChips ? `<div class="filter-info">🔍 סינון: ${filterChips}</div>` : ""}
  <table>
    <thead>
      <tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="summary-row">${summaryItems}</div>
  <div class="noprint" style="text-align:center;margin-top:22px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#8B0000;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">🖨️ הדפס / שמור כ-PDF</button>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("נא לאפשר חלונות קופצים בדפדפן");
    return;
  }
  w.document.write(html);
  w.document.close();
};

/* ============================================================
   3. Helper: Normalize Firestore docs
   ============================================================ */
const normalize = (type, raw) => {
  return raw.map((d) => {
    const o = { ...d };
    if (type === "elderly") {
      o.fullName = `${d.firstName || ""} ${d.lastName || ""}`.trim() || d.fullName || "";
    }
    if (type === "volunteers") {
      o.fullName = d.fullName || `${d.firstName || ""} ${d.lastName || ""}`.trim();
    }
    ["createdAt", "date", "meetingDate", "startDate", "endDate", "birth", "lastContact"].forEach((k) => {
      if (o[k] && typeof o[k] === "object" && o[k].seconds) {
        o[k] = new Date(o[k].seconds * 1000).toLocaleDateString("he-IL");
      }
    });
    return o;
  });
};

/* ============================================================
   4. Cards grid view
   ============================================================ */
const ReportsGrid = ({ onOpen }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 28 }}>
    {Object.values(REPORT_TYPES).map((r) => (
      <div key={r.id} className="section-card" style={{ textAlign: "right" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>{r.icon}</div>
        <h3 style={{ color: "#8B0000", margin: "0 0 6px", fontSize: 19 }}>{r.label}</h3>
        <p style={{ color: "#666", fontSize: 13, margin: "0 0 18px", minHeight: 36 }}>{r.description}</p>
        <button className="btn btn-primary" onClick={() => onOpen(r.id)} style={{ width: "100%" }}>פתיחת דוח</button>
      </div>
    ))}
  </div>
);

/* ============================================================
   5. Report builder
   ============================================================ */
const ReportBuilder = ({ reportKey, onBack }) => {
  const report = REPORT_TYPES[reportKey];
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [selectedFields, setSelectedFields] = useState(report.defaults);
  const [filters, setFilters] = useState({});
  const [showFields, setShowFields] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, report.collection));
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (alive) {
          const rows = raw.length ? normalize(reportKey, raw) : (SEED_DATA[reportKey] || []);
          setAllData(rows);
        }
      } catch (e) {
        console.error("Failed to load", report.collection, e);
        if (alive) setAllData(SEED_DATA[reportKey] || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reportKey]);

  const filterOptions = useMemo(() => {
    const opts = {};
    report.filters.forEach((f) => {
      opts[f.key] = [...new Set(allData.map((r) => r[f.key]).filter(Boolean))];
    });
    return opts;
  }, [allData, report]);

  const filteredData = useMemo(() => {
    return allData.filter((row) =>
      Object.entries(filters).every(([k, v]) => !v || row[k] === v)
    );
  }, [allData, filters]);

  const toggleField = (k) =>
    setSelectedFields((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]
    );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn" onClick={onBack}>→ חזרה לדוחות</button>
        <h2 style={{ margin: 0, color: "#8B0000" }}>{report.icon} {report.label}</h2>
      </div>

      {/* Filters */}
      {report.filters.length > 0 && (
        <SectionCard title="סינון נתונים">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {report.filters.map((f) => (
              <select
                key={f.key}
                value={filters[f.key] || ""}
                onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 160 }}
              >
                <option value="">{`כל ${f.label}`}</option>
                {(filterOptions[f.key] || []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ))}
            {Object.values(filters).some(Boolean) && (
              <button className="btn" onClick={() => setFilters({})}>נקה סינון</button>
            )}
          </div>
        </SectionCard>
      )}

      {/* Fields selector */}
      <SectionCard
        title={`בחירת עמודות (${selectedFields.length}/${report.fields.length})`}
        actions={
          <button className="btn" onClick={() => setShowFields((v) => !v)}>
            {showFields ? "הסתר" : "הצג"}
          </button>
        }
      >
        {showFields && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setSelectedFields(report.fields.map((f) => f.key))}>בחר הכל</button>
              <button className="btn" onClick={() => setSelectedFields([])}>נקה הכל</button>
              <button className="btn" onClick={() => setSelectedFields(report.defaults)}>ברירת מחדל</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {report.fields.map((f) => (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #eee", borderRadius: 8, cursor: "pointer", background: selectedFields.includes(f.key) ? "#fff5f5" : "#fff" }}>
                  <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleField(f.key)} />
                  <span style={{ flex: 1 }}>{f.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* Action bar */}
      <div style={{ display: "flex", gap: 12, margin: "20px 0", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => exportToPDF(report, filteredData, selectedFields, filters)} disabled={!filteredData.length || !selectedFields.length}>
          📄 ייצוא ל-PDF
        </button>
        <div style={{ marginInlineStart: "auto", color: "#666", alignSelf: "center" }}>
          {loading ? "טוען…" : `${filteredData.length} רשומות`}
        </div>
      </div>

      {/* Preview */}
      <SectionCard title="תצוגה מקדימה">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>טוען נתונים…</div>
        ) : !selectedFields.length ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>בחר לפחות עמודה אחת</div>
        ) : !filteredData.length ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>אין נתונים להצגה</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>{selectedFields.map((k) => {
                  const f = report.fields.find((x) => x.key === k);
                  return <th key={k}>{f?.label || k}</th>;
                })}</tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 50).map((row, i) => (
                  <tr key={row.id || i}>
                    {selectedFields.map((k) => (
                      <td key={k}>{row[k] == null || row[k] === "" ? "—" : String(row[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length > 50 && (
              <div style={{ padding: 12, textAlign: "center", color: "#666", fontSize: 13 }}>
                מוצגות 50 רשומות ראשונות מתוך {filteredData.length} • ייצוא PDF יכלול את כולן
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </>
  );
};

/* ============================================================
   6. Quick stats
   ============================================================ */
const QuickStats = () => {
  const [stats, setStats] = useState({ elderly: [], volunteers: [], projects: [] });

  useEffect(() => {
    (async () => {
      try {
        const [e, v, p] = await Promise.all([
          getDocs(collection(db, "elderly")),
          getDocs(collection(db, "volunteers")),
          getDocs(collection(db, "projects")),
        ]);
        setStats({
          elderly: e.docs.map((d) => d.data()),
          volunteers: v.docs.map((d) => d.data()),
          projects: p.docs.map((d) => d.data()),
        });
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const byKey = (arr, key) => {
    const m = {};
    arr.forEach((x) => {
      const k = x[key] || "ללא";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  const elderlyByHood = byKey(stats.elderly, "neighborhood").slice(0, 6);
  const volunteersByStatus = byKey(stats.volunteers, "status").slice(0, 6);

 
};

/* ============================================================
   7a. Holiday Summary Component
   ============================================================ */
const HolidaySummary = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [projects, setProjects] = useState([]);

  // جلب البيانات
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "financial"));
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (alive) {
          const rows = raw.length ? normalize("financial", raw) : FINANCIAL_SEED;
          setAllData(rows);
          const projectList = [...new Set(rows.map(r => r.project).filter(Boolean))];
          setProjects(projectList);
          if (projectList.length > 0) setSelectedProject(projectList[0]);
        }
      } catch (e) {
        console.error(e);
        if (alive) {
          setAllData(FINANCIAL_SEED);
          const projectList = [...new Set(FINANCIAL_SEED.map(r => r.project).filter(Boolean))];
          setProjects(projectList);
          if (projectList.length > 0) setSelectedProject(projectList[0]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // تصفية البيانات حسب المشروع المختار
  const filteredData = useMemo(() => {
    if (!selectedProject) return allData;
    return allData.filter(r => r.project === selectedProject);
  }, [allData, selectedProject]);

  // تقسيم إلى הכנסות והוצאות
  const incomes = filteredData.filter(r => /תרומ|הכנס|income|donation/i.test(String(r.type || "")));
  const expenses = filteredData.filter(r => !/תרומ|הכנס|income|donation/i.test(String(r.type || "")));

  // حساب المجاميع
  const sum = (arr) => arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalIn = sum(incomes);
  const totalOut = sum(expenses);
  const maxRows = Math.max(incomes.length, expenses.length, 5);

  // دالة التصدير
  const exportHolidayPDF = () => {
    if (!filteredData.length) {
      alert("אין נתונים לייצוא");
      return;
    }

    const today = new Date().toLocaleDateString("he-IL");
    const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");
    const cell = (v) => (v == null || v === "" ? "&nbsp;" : String(v));

    const rowsHTML = Array.from({ length: maxRows })
      .map((_, i) => {
        const inc = incomes[i];
        const exp = expenses[i];
        return `<tr>
          <td>${inc ? cell(inc.name) : "&nbsp;"}</td>
          <td class="num">${inc ? fmt(inc.amount) : "&nbsp;"}</td>
          <td>${exp ? cell(exp.name) : "&nbsp;"}</td>
          <td class="num">${exp ? fmt(exp.amount) : "&nbsp;"}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>סיכום ${selectedProject}</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", "David", sans-serif; color: #111; margin: 0; }
  .date-top { text-align: left; font-size: 13px; color: #555; margin-bottom: 6px; }
  .main-title { text-align: center; font-size: 24px; font-weight: 700; color: #8B0000; margin: 4px 0 2px; text-decoration: underline; }
  .sub-title { text-align: center; font-size: 18px; font-weight: 600; color: #8B0000; margin: 0 0 16px; text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 10px 8px; text-align: right; vertical-align: middle; }
  thead th.group { font-size: 18px; font-weight: 700; background: #f5f0ed; padding: 14px 8px; }
  thead th.sub { font-size: 14px; font-weight: 600; background: #f5f0ed; }
  td { height: 38px; font-size: 13px; }
  td.num { width: 18%; }
  tfoot td { font-weight: 700; background: #f3f3f3; font-size: 14px; }
  .summary-row { margin-top: 16px; padding: 12px 16px; background: #f5f0ed; border: 1px solid #ddd; border-radius: 6px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 20px; }
  .summary-row .item { font-size: 14px; }
  .summary-row .item strong { color: #8B0000; }
  @media print { .noprint { display: none; } }
</style></head><body>
<div class="date-top">📅 ${today}</div>
<div class="main-title">פרויקט מתחברים</div>
<div class="sub-title">סיכום הכנסות והוצאות - ${selectedProject}</div>
<table>
  <thead>
    <tr>
      <th class="group" colspan="2">הכנסות</th>
      <th class="group" colspan="2">הוצאות</th>
    </tr>
    <tr>
      <th class="sub">שם</th><th class="sub">סכום</th>
      <th class="sub">שם</th><th class="sub">סכום</th>
    </tr>
  </thead>
  <tbody>${rowsHTML}</tbody>
  <tfoot>
    <tr>
      <td>סה"כ</td><td class="num">${fmt(totalIn)} ₪</td>
      <td>סה"כ</td><td class="num">${fmt(totalOut)} ₪</td>
    </tr>
  </tfoot>
</table>
<div class="summary-row">
  <div class="item">📊 יתרה: <strong>${fmt(totalIn - totalOut)} ₪</strong></div>
  <div class="item">📅 הופק: <strong>${today}</strong></div>
</div>
<div class="noprint" style="text-align:center;margin-top:22px;">
  <button onclick="window.print()" style="padding:10px 24px;background:#8B0000;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">🖨️ הדפס / שמור כ-PDF</button>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("נא לאפשר חלונות קופצים בדפדפן"); return; }
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>טוען נתונים...</div>;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn" onClick={onBack}>→ חזרה</button>
        <h2 style={{ margin: 0, color: "#8B0000" }}>🎄 סיכום הכנסות והוצאות לפי חג</h2>
      </div>

      <SectionCard title="בחירת חג / פרויקט">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
          >
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={exportHolidayPDF} disabled={!filteredData.length}>
            📄 ייצוא ל-PDF
          </button>
          <div style={{ marginInlineStart: "auto", color: "#666" }}>
            {filteredData.length} רשומות • הכנסות: {totalIn.toLocaleString("he-IL")} ₪ • הוצאות: {totalOut.toLocaleString("he-IL")} ₪
          </div>
        </div>
      </SectionCard>

      {/* טבלת סיכום - כמו בתמונה */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <SectionCard title={`הכנסות (${incomes.length})`}>
          {incomes.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>אין הכנסות</p>
          ) : (
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>שם</th><th style={{ width: 120 }}>סכום</th></tr></thead>
              <tbody>
                {incomes.map((r, i) => (
                  <tr key={r.id || i}><td>{r.name || "—"}</td><td>{(Number(r.amount) || 0).toLocaleString("he-IL")} ₪</td></tr>
                ))}
                <tr style={{ fontWeight: 700, background: "#f7f7f7" }}>
                  <td>סה"כ</td><td>{totalIn.toLocaleString("he-IL")} ₪</td>
                </tr>
              </tbody>
            </table>
          )}
        </SectionCard>
        <SectionCard title={`הוצאות (${expenses.length})`}>
          {expenses.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>אין הוצאות</p>
          ) : (
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>שם</th><th style={{ width: 120 }}>סכום</th></tr></thead>
              <tbody>
                {expenses.map((r, i) => (
                  <tr key={r.id || i}><td>{r.name || "—"}</td><td>{(Number(r.amount) || 0).toLocaleString("he-IL")} ₪</td></tr>
                ))}
                <tr style={{ fontWeight: 700, background: "#f7f7f7" }}>
                  <td>סה"כ</td><td>{totalOut.toLocaleString("he-IL")} ₪</td>
                </tr>
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </>
  );
};


/* ============================================================
   7. Financial sub-reports
   ============================================================ */
const DONATION_CATEGORIES = ["העברה בבית", "העברה במזומן", "העברה מ.מנהל קהילתי גילה"];

const DonationsSummary = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "financial"));
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const normalized = raw.length ? normalize("financial", raw) : FINANCIAL_SEED;
        if (alive) setRows(normalized.filter((r) => /תרומ|donation/i.test(String(r.type || ""))));
      } catch (e) {
        console.error(e);
        if (alive) setRows(FINANCIAL_SEED.filter((r) => r.type === "תרומה"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const groups = DONATION_CATEGORIES.map((cat) => ({
    category: cat,
    items: rows.filter((r) => (r.subType || "") === cat),
  }));

  const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");
  const cell = (v) => (v == null || v === "" ? "&nbsp;" : String(v));

  const buildGroupTable = (g) => {
    const total = g.items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const body = g.items.length
      ? g.items.map((r) => `<tr>
          <td>${cell(r.name)}</td>
          <td class="num">${fmt(r.amount)} ₪</td>
          <td>${(r.receiptType || "").includes("46") ? "" : "✔"}</td>
          <td>${(r.receiptType || "").includes("46") ? "✔" : ""}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="text-align:center;color:#888;">אין נתונים</td></tr>`;
    return `
      <h3 class="grp-title">${g.category}</h3>
      <table>
        <thead><tr><th>שם</th><th>סכום</th><th>קבלה רגילה</th><th>קבלה 46</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td>סה"כ</td><td class="num">${fmt(total)} ₪</td><td colspan="2"></td></tr></tfoot>
      </table>`;
  };

  const printPDF = (selected /* array of categories */) => {
    const chosen = groups.filter((g) => selected.includes(g.category));
    if (!chosen.some((g) => g.items.length)) {
      alert("אין נתונים לייצוא");
      return;
    }
    const today = new Date().toLocaleDateString("he-IL");
    const title = selected.length === 1 ? `סיכום תרומות — ${selected[0]}` : "סיכום תרומות";
    const grandTotal = chosen.reduce((s, g) => s + g.items.reduce((a, r) => a + (Number(r.amount) || 0), 0), 0);

    const html = `<!doctype html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", "David", sans-serif; color: #111; margin: 0; }
  .date-top { text-align: left; font-size: 13px; color: #555; margin-bottom: 6px; }
  .main-title { text-align: center; font-size: 24px; font-weight: 700; color: #8B0000; margin: 4px 0 2px; text-decoration: underline; }
  .sub-title { text-align: center; font-size: 18px; font-weight: 600; color: #8B0000; margin: 0 0 16px; text-decoration: underline; }
  .grp-title { color: #8B0000; font-size: 16px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #111; padding: 8px; text-align: right; font-size: 13px; }
  th { background: #f5f0ed; font-weight: 700; }
  td.num { width: 18%; }
  tfoot td { font-weight: 700; background: #f3f3f3; }
  .summary-row { margin-top: 16px; padding: 12px 16px; background: #f5f0ed; border: 1px solid #ddd; border-radius: 6px; }
  .summary-row strong { color: #8B0000; }
  @media print { .noprint { display: none; } }
</style></head><body>
<div class="date-top">📅 ${today}</div>
<div class="main-title">פרויקט מתחברים</div>
<div class="sub-title">${title}</div>
${chosen.map(buildGroupTable).join("")}
<div class="summary-row">סה"כ תרומות: <strong>${fmt(grandTotal)} ₪</strong></div>
<div class="noprint" style="text-align:center;margin-top:22px;">
  <button onclick="window.print()" style="padding:10px 24px;background:#8B0000;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">🖨️ הדפס / שמור כ-PDF</button>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("נא לאפשר חלונות קופצים בדפדפן"); return; }
    w.document.write(html);
    w.document.close();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>טוען נתונים...</div>;

  const grandTotal = groups.reduce((s, g) => s + g.items.reduce((a, r) => a + (Number(r.amount) || 0), 0), 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn" onClick={onBack}>→ חזרה</button>
        <h2 style={{ margin: 0, color: "#8B0000" }}>❤️ סיכום תרומות</h2>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => printPDF(DONATION_CATEGORIES)}>
            📄 ייצוא PDF — כל הסוגים
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {groups.map((g) => {
          const total = g.items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
          return (
            <SectionCard
              key={g.category}
              title={`${g.category} (${g.items.length})`}
              actions={
                <button className="btn btn-primary" onClick={() => printPDF([g.category])} disabled={!g.items.length}>
                  📄 הפקת PDF
                </button>
              }
            >
              <table className="data-table" style={{ width: "100%" }}>
                <thead><tr><th>שם</th><th>סכום</th><th>קבלה רגילה</th><th>קבלה 46</th></tr></thead>
                <tbody>
                  {g.items.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: "center", color: "#888" }}>אין נתונים</td></tr>
                  ) : (
                    g.items.map((r, i) => (
                      <tr key={r.id || i}>
                        <td>{r.name || "—"}</td>
                        <td>{(Number(r.amount) || 0).toLocaleString("he-IL")} ₪</td>
                        <td>{(r.receiptType || "").includes("46") ? "" : "✔"}</td>
                        <td>{(r.receiptType || "").includes("46") ? "✔" : ""}</td>
                      </tr>
                    ))
                  )}
                  <tr style={{ fontWeight: 700, background: "#f7f7f7" }}>
                    <td>סה"כ</td><td>{total.toLocaleString("he-IL")} ₪</td><td colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
            </SectionCard>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "12px 16px", background: "#f5f0ed", border: "1px solid #ddd", borderRadius: 6, fontWeight: 600 }}>
        סה"כ תרומות בכל הסוגים: <span style={{ color: "#8B0000" }}>{grandTotal.toLocaleString("he-IL")} ₪</span>
      </div>
    </>
  );
};

const FINANCIAL_SUBREPORTS = [
  { key: "general", icon: "💰", label: "דוח כספי כללי", description: "טבלה מלאה של כל ההכנסות וההוצאות" },
  { key: "holiday", icon: "🎄", label: "סיכום הכנסות והוצאות לפי חג", description: "טבלה דו-טורית: הכנסות מול הוצאות" },
  { key: "donations", icon: "❤️", label: "סיכום תרומות", description: "מתחלק ל-3 סוגי העברה" },
];

const FinancialChooser = ({ onBack }) => {
  const [mode, setMode] = useState(null);

  if (mode === "general") return <ReportBuilder reportKey="financial" onBack={() => setMode(null)} />;
  
 if (mode === "holiday") {
  return <HolidaySummary onBack={() => setMode(null)} />;
}
  if (mode === "donations") return <DonationsSummary onBack={() => setMode(null)} />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn" onClick={onBack}>→ חזרה לדוחות</button>
        <h2 style={{ margin: 0, color: "#8B0000" }}>💰 דוחות כספיים</h2>
      </div>
      <p style={{ color: "#666", margin: "0 0 16px" }}>בחר את סוג הדוח שברצונך להפיק ולייצא ל-PDF:</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {FINANCIAL_SUBREPORTS.map((r) => (
          <div key={r.key} className="section-card" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{r.icon}</div>
            <h3 style={{ color: "#8B0000", margin: "0 0 6px", fontSize: 18 }}>{r.label}</h3>
            <p style={{ color: "#666", fontSize: 13, margin: "0 0 18px", minHeight: 52 }}>{r.description}</p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setMode(r.key)}>פתיחה</button>
          </div>
        ))}
      </div>
    </>
  );
};

/* ============================================================
   8. Main export
   ============================================================ */
export default function Reports() {
  const [active, setActive] = useState(null);

  return (
    <AdminLayout title="דוחות" subtitle={active ? "בניית דוח מותאם אישית" : "נתונים וסטטיסטיקות מהמערכת"}>
      {active ? (
        active === "financial" ? (
          <FinancialChooser onBack={() => setActive(null)} />
        ) : (
          <ReportBuilder reportKey={active} onBack={() => setActive(null)} />
        )
      ) : (
        <>
          <ReportsGrid onOpen={setActive} />
          <h3 style={{ color: "#8B0000", margin: "8px 0 16px" }}></h3>
          <QuickStats />
        </>
      )}
    </AdminLayout>
  );
}