// src/admin/Reports.jsx
import { useState, useEffect, useMemo } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { getElderly } from "@/services/elderlyService.js";
import { getVolunteers, getVolunteerGroups } from "@/services/volunteersService.js";
import { getParliaments, getParticipants, getMeetings } from "@/services/parliamentsService.js";
import { getProjects, getProjectGroups, getElderlyParticipants } from "@/services/projectsService.js";
import { getJoinRequests } from "@/services/joinRequestsService.js";
import { getFinancialRecords, seedFinancialDummyData } from "@/services/financialService.js";
import VolunteerCharts, { getVolunteerChartData } from "@/components/admin/VolunteerCharts.jsx";

import { 
  HeartHandshake, 
  Handshake, 
  Gift, 
  Landmark, 
  Coins, 
  FileText, 
  Printer, 
  Search, 
  BarChart3, 
  Puzzle 
} from "lucide-react";

const ICON_MAP = {
  "👵": HeartHandshake,
  "🤝": Handshake,
  "🎁": Gift,
  "🏛️": Landmark,
  "🏛": Landmark,
  "💰": Coins,
  "🎄": Gift,
  "📄": FileText,
  "🖨": Printer,
  "🔍": Search,
  "📊": BarChart3,
  "🧩": Puzzle,
};

function getReportIcon(iconStr, size = 24) {
  const IconComponent = ICON_MAP[iconStr];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  return iconStr;
}

// ============================================================
// IMPORT REcharts FOR CHARTS
// ============================================================
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ============================================================
// CHART COLORS
// ============================================================
const CHART_COLORS = [
  "#8B0000",
  "#D4A574",
  "#2e7d32",
  "#ed6c02",
  "#0288d1",
  "#7b1fa2",
  "#00695c",
  "#e65100",
  "#4a148c",
  "#bf360c",
];

const formatDeletedAt = (deletedAt) => {
  if (!deletedAt) return "";
  if (deletedAt.toDate && typeof deletedAt.toDate === "function") {
    return deletedAt.toDate().toLocaleDateString("he-IL");
  }
  if (deletedAt.seconds) {
    return new Date(deletedAt.seconds * 1000).toLocaleDateString("he-IL");
  }
  return String(deletedAt);
};

/* ============================================================
   REPORT DEFINITIONS - All data comes from Firebase only
   No SEED data - pure Firestore connection
   ============================================================ */
const REPORT_TYPES = {
  elderly: {
    id: "elderly",
    icon: "👵",
    label: "דוח אזרחים ותיקים",
    description: "פילוח לפי שכונה, אזור, סטטוס ופרויקטים",
    collection: "elderly",
    loadData: async () => {
      try {
        const [elderly, projs, volGroups] = await Promise.all([
          getElderly(),
          getProjects(),
          getVolunteerGroups(),
        ]);

        const groupMap = {
          "עצמאי": "עצמאיים",
          "עצמאיים": "עצמאיים",
          "": "עצמאיים",
          "undefined": "עצמאיים",
          "null": "עצמאיים",
        };
        volGroups.forEach((g) => {
          groupMap[g.id] = g.name;
        });

        // For each project, fetch its elderly participants
        const elderlyProjMap = {}; // elderlyId -> Array of project participations
        await Promise.all(
          projs.map(async (p) => {
            try {
              const participants = await getElderlyParticipants(p.id);
              participants.forEach((ep) => {
                const elderlyId = ep.id;
                if (!elderlyProjMap[elderlyId]) {
                  elderlyProjMap[elderlyId] = [];
                }
                elderlyProjMap[elderlyId].push({
                  projectName: p.name,
                  projectYear: p.year,
                  groupName: groupMap[ep.assignedGroupId] || "עצמאיים",
                  receives: ep.receives || "כן",
                  delivery: ep.delivery || "ממתין למסירה",
                  notes: ep.notes || "",
                });
              });
            } catch (err) {
              console.warn("Failed to load participants for project", p.id, err);
            }
          })
        );

        const allRows = [];
        elderly.forEach((e) => {
          const participations = elderlyProjMap[e.id] || [];
          const baseName = `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || "";
          if (participations.length === 0) {
            allRows.push({
              ...e,
              name: baseName,
              projectName: "—",
              projectYear: "—",
              groupName: "—",
              receives: "—",
              delivery: "—",
              projectNotes: "",
            });
          } else {
            participations.forEach((part) => {
              allRows.push({
                ...e,
                name: baseName,
                projectName: part.projectName,
                projectYear: part.projectYear,
                groupName: part.groupName,
                receives: part.receives,
                delivery: part.delivery,
                projectNotes: part.notes,
              });
            });
          }
        });

        return allRows;
      } catch (error) {
        console.error("Failed to load elderly report data:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם מלא" },
      { key: "gender", label: "מגדר" },
      { key: "address", label: "כתובת" },
      { key: "mobile", label: "טלפון" },
      { key: "contactPhone", label: "טל מישהו קרוב" },
      { key: "lastContact", label: "תאריך יצירת קשר אחרון" },
      { key: "notes", label: "הערות נוספות" },
      { key: "birth", label: "ת.לידה" },
      { key: "idNum", label: "ת.ז" },
      { key: "homePhone", label: "טלפון בית" },
      { key: "neighborhood", label: "שכונה" },
      { key: "area", label: "אזור" },
      { key: "volStatus", label: "סטטוס מתנדב" },
      { key: "volName", label: "מתנדב משויך" },
      { key: "contactName", label: "איש קשר" },
      { key: "parliament", label: "פרלמנט" },
      { key: "status", label: "סטטוס" },
      { key: "assistance", label: "סיוע" },
      { key: "marital", label: "מצב משפחתי" },
      { key: "country", label: "ארץ לידה" },
      { key: "language", label: "שפת דיבור" },
      { key: "projectName", label: "שם הפרויקט" },
      { key: "projectYear", label: "שנת פרויקט" },
      { key: "groupName", label: "קבוצה מחלקת בפרויקט" },
      { key: "receives", label: "מקבל חבילה בפרויקט" },
      { key: "delivery", label: "סטטוס מסירה בפרויקט" },
      { key: "isArchived", label: "מצב ארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "gender", "address", "mobile", "projectName", "groupName", "delivery"],
    filters: [
      { key: "gender", label: "מגדר", type: "select", options: ["זכר", "נקבה"] },
      { key: "neighborhood", label: "שכונה", type: "select" },
      { key: "area", label: "אזור", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["פעיל", "נפטר", "לא פעיל"] },
      { key: "volStatus", label: "סטטוס מתנדב", type: "select", options: ["כן", "לא מתאים", "לא רוצה"] },
      { key: "parliament", label: "פרלמנט", type: "select" },
      { key: "projectName", label: "פרויקט", type: "select" },
      { key: "groupName", label: "קבוצה מחלקת בפרויקט", type: "select" },
      { key: "delivery", label: "סטטוס מסירה בפרויקט", type: "select", options: ["נמסר", "ממתין למסירה", "לא נמסר"] },
    ],
    sortOptions: [
      { value: "name", label: "שם (א-ב)" },
      { value: "-name", label: "שם (ב-א)" },
      { value: "neighborhood", label: "שכונה" },
      { value: "lastContact", label: "תאריך יצירת קשר אחרון" },
      { value: "projectName", label: "שם הפרויקט" },
    ],
    transform: (item) => ({
      ...item,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: formatDeletedAt(item.deletedAt),
    }),
  },
  volunteers: {
    id: "volunteers",
    icon: "🤝",
    label: "דוח מתנדבים",
    description: "סטטוס, קבוצות, שיבוצים",
    collection: "volunteers",
    loadData: async () => {
      try {
        const [vols, groups] = await Promise.all([getVolunteers(), getVolunteerGroups()]);
        const groupTypeMap = {};
        groups.forEach((g) => {
          if (g.name) groupTypeMap[g.name] = g.type;
        });
        return (vols || []).map((v) => {
          const isGroup = v.group && v.group !== "ללא קבוצה" && v.group !== "עצמאי" && v.group !== "עצמאיים";
          return {
            ...v,
            volunteerType: isGroup ? "קבוצה" : "עצמאי",
            groupType: isGroup ? (groupTypeMap[v.group] || "אחר") : "עצמאי",
          };
        });
      } catch (error) {
        console.error("Failed to load volunteers from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם מלא" },
      { key: "phone", label: "טלפון" },
      { key: "volunteerType", label: "סוג מתנדב" },
      { key: "group", label: "קבוצה" },
      { key: "groupType", label: "סוג קבוצה" },
      { key: "status", label: "סטטוס" },
      { key: "assigned", label: "משויך לאזרח" },
      { key: "start", label: "תאריך התחלה" },
      { key: "end", label: "תאריך סיום" },
      { key: "area", label: "אזור" },
      { key: "neighborhood", label: "שכונה" },
      { key: "address", label: "כתובת" },
      { key: "insurance", label: "ביטוח" },
      { key: "notes", label: "הערות" },
      { key: "isArchived", label: "מצב ארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "phone", "volunteerType", "group", "groupType", "status", "assigned", "start"],
    filters: [
      { key: "volunteerType", label: "סוג מתנדב", type: "select", options: ["עצמאי", "קבוצה"] },
      { key: "group", label: "קבוצה", type: "select" },
      { key: "groupType", label: "סוג קבוצה", type: "select", options: ["סטודנטים", "בית ספר", "חברה", "עמותה", "עצמאי", "אחר"] },
      { key: "status", label: "סטטוס", type: "select", options: ["פעיל", "ממתין לשיבוץ", "לא פעיל"] },
      { key: "area", label: "אזור", type: "select" },
      { key: "neighborhood", label: "שכונה", type: "select" },
      { key: "insurance", label: "ביטוח", type: "select", options: ["כן", "לא"] },
      { key: "startFrom", label: "תאריך התחלה - מ", type: "date" },
      { key: "startTo", label: "תאריך התחלה - עד", type: "date" },
    ],
    sortOptions: [
      { value: "name", label: "שם (א-ב)" },
      { value: "-name", label: "שם (ב-א)" },
      { value: "volunteerType", label: "סוג מתנדב" },
      { value: "group", label: "קבוצה" },
      { value: "groupType", label: "סוג קבוצה" },
      { value: "status", label: "סטטוס" },
      { value: "start", label: "תאריך התחלה" },
    ],
    // ===== CHART DATA =====
    getChartData: getVolunteerChartData,
    transform: (item) => ({
      ...item,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: formatDeletedAt(item.deletedAt),
    }),
  },
  projects: {
    id: "projects",
    icon: "🎁",
    label: "דוח פרויקטים",
    description: "התקדמות, מסירות ובעיות",
    collection: "projects",
    loadData: async () => {
      try {
        const [projs, volGroups] = await Promise.all([getProjects(), getVolunteerGroups()]);
        const groupMap = {};
        volGroups.forEach((g) => {
          groupMap[g.id] = g.name;
        });

        const resolved = await Promise.all(
          projs.map(async (p) => {
            const grps = await getProjectGroups(p.id);
            const groupNames = grps.map((g) => groupMap[g.id]).filter(Boolean);
            return {
              ...p,
              groupNames: groupNames.join(", "),
              groupList: groupNames,
            };
          })
        );
        return resolved || [];
      } catch (error) {
        console.error("Failed to load projects from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם הפרויקט" },
      { key: "holiday", label: "חג" },
      { key: "year", label: "שנה" },
      { key: "date", label: "תאריך חלוקה" },
      { key: "elderly", label: "אזרחים ותיקים" },
      { key: "assigned", label: "שובצו" },
      { key: "delivered", label: "נמסרו" },
      { key: "groupNames", label: "קבוצות שותפות" },
      { key: "issues", label: "בעיות" },
      { key: "status", label: "סטטוס" },
      { key: "isArchived", label: "מצב ארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "year", "status", "elderly", "delivered", "groupNames"],
    filters: [
      { key: "name", label: "פרויקט", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["מתוכנן", "בהכנה", "פעיל", "הסתיים"] },
      { key: "year", label: "שנה", type: "select" },
      { key: "projectGroup", label: "קבוצה שותפה בפרויקט", type: "select" },
    ],
    sortOptions: [
      { value: "name", label: "שם" },
      { value: "year", label: "שנה" },
      { value: "status", label: "סטטוס" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      const barData = data
        .map((item) => {
          const name = item.name || "ללא שם";
          const year = item.year ? ` (${item.year})` : "";
          return {
            name: `${name}${year}`,
            delivered: Number(item.delivered) || 0,
            total: Number(item.elderly) || 0,
            year: item.year || "",
            date: item.date || "",
          };
        })
        .sort((a, b) => {
          if (a.year !== b.year) {
            return String(a.year).localeCompare(String(b.year));
          }
          return String(a.date).localeCompare(String(b.date));
        });

      return { barData };
    },
    transform: (item) => ({
      ...item,
      progress: item.elderly ? Math.round((item.delivered / item.elderly) * 100) : 0,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: formatDeletedAt(item.deletedAt),
    }),
  },
  parliaments: {
    id: "parliaments",
    icon: "🏛️",
    label: "דוח פרלמנטים",
    description: "השתתפות ונוכחות",
    collection: "parliaments",
    loadData: async () => {
      try {
        const list = await getParliaments();
        const today = new Date().toISOString().slice(0, 10);
        
        const resolved = await Promise.all(
          (list || []).map(async (p) => {
            try {
              const [parts, meets] = await Promise.all([
                getParticipants(p.id).catch(() => []),
                getMeetings(p.id).catch(() => []),
              ]);
              const nextMeeting = meets
                .filter((m) => m.date && m.date >= today)
                .sort((a, b) => String(a.date).localeCompare(String(b.date))
                  || String(a.startTime || "").localeCompare(String(b.startTime || "")));
              
              const pastMeetingsCount = meets.filter(m => m.date && m.date <= today).length;
              
              return {
                ...p,
                members: parts.length,
                meetings: pastMeetingsCount,
                nextDate: nextMeeting.length ? nextMeeting[0].date : "",
              };
            } catch (err) {
              console.warn("Failed to load participants/meetings for parliament", p.id, err);
              return {
                ...p,
                members: 0,
                meetings: 0,
                nextDate: "",
              };
            }
          })
        );
        return resolved || [];
      } catch (error) {
        console.error("Failed to load parliaments from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם הפרלמנט" },
      { key: "location", label: "מיקום" },
      { key: "area", label: "אזור" },
      { key: "neighborhood", label: "שכונה" },
      { key: "coordinators", label: "מלווים" },
      { key: "members", label: "משתתפים" },
      { key: "nextDate", label: "מפגש הבא" },
      { key: "status", label: "סטטוס" },
      { key: "notes", label: "הערות" },
      { key: "isArchived", label: "מצב ארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "location", "area", "neighborhood", "members", "nextDate", "status"],
    filters: [
      { key: "area", label: "אזור", type: "select" },
      { key: "neighborhood", label: "שכונה", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["פעיל", "בהכנה", "הסתיים"] },
    ],
    sortOptions: [
      { value: "name", label: "שם" },
      { value: "area", label: "אזור" },
      { value: "status", label: "סטטוס" },
      { value: "nextDate", label: "תאריך מפגש" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Bar: Parliament Meetings
      const barData = data
        .map((item) => ({
          name: item.name || "ללא שם",
          meetings: item.meetings || 0,
        }))
        .sort((a, b) => b.meetings - a.meetings);

      return { barData };
    },
    transform: (item) => ({
      ...item,
      coordinators: (item.coordinators || []).join(", "),
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: formatDeletedAt(item.deletedAt),
    }),
  },
  joinRequests: {
    id: "joinRequests",
    icon: "✉️",
    label: "דוח בקשות הצטרפות",
    description: "בקשות וטיפול",
    collection: "joinRequests",
    loadData: async () => {
      try {
        const data = await getJoinRequests();
        return (data || []).map((r) => ({
          ...r,
          name: r.fullName || r.name || "—",
          email: r.email || "—",
          phone: r.phone || "—",
          type: r.type || "—",
          note: r.note || "—",
        }));
      } catch (error) {
        console.error("Failed to load join requests from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם מלא" },
      { key: "phone", label: "טלפון" },
      { key: "email", label: "אימייל" },
      { key: "type", label: "סוג פנייה" },
      { key: "note", label: "הערות" },
      { key: "status", label: "סטטוס" },
    ],
    defaults: ["name", "phone", "email", "type", "note", "status"],
    filters: [
      { key: "status", label: "סטטוס", type: "select", options: ["חדש", "בטיפול", "טופל"] },
      { key: "type", label: "סוג פנייה", type: "select" },
    ],
    sortOptions: [
      { value: "name", label: "שם" },
      { value: "status", label: "סטטוס" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Pie: Requests by Status
      const statusCount = {};
      data.forEach((item) => {
        const key = item.status || "ללא סטטוס";
        statusCount[key] = (statusCount[key] || 0) + 1;
      });
      const pieData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

      return { pieData };
    },
    transform: (item) => item,
  },
  financial: {
    id: "financial",
    icon: "💰",
    label: "דוח כספי",
    description: "הכנסות, הוצאות ותרומות",
    collection: "financial",
    loadData: async () => {
      try {
        const data = await getFinancialRecords();
        return data || [];
      } catch (error) {
        console.error("Failed to load financial data from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "type", label: "סוג" },
      { key: "subType", label: "תת-סוג" },
      { key: "name", label: "שם" },
      { key: "amount", label: "סכום (₪)" },
      { key: "date", label: "תאריך" },
      { key: "project", label: "פרויקט" },
      { key: "receiptType", label: "סוג קבלה" },
      { key: "receiptSent", label: "נשלחה קבלה" },
    ],
    defaults: ["type", "name", "amount", "date", "project"],
    filters: [
      { key: "type", label: "סוג", type: "select", options: ["תרומה", "הוצאה"] },
      { key: "project", label: "פרויקט", type: "select" },
      { key: "receiptType", label: "סוג קבלה", type: "select", options: ["קבלה רגילה", "קבלה 46"] },
    ],
    sortOptions: [
      { value: "date", label: "תאריך" },
      { value: "amount", label: "סכום" },
      { value: "type", label: "סוג" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Bar: Income vs Expenses by Project
      const projectData = {};
      data.forEach((item) => {
        const key = item.project || "ללא פרויקט";
        if (!projectData[key]) {
          projectData[key] = { name: key, income: 0, expense: 0 };
        }
        if (item.type === "תרומה") {
          projectData[key].income += Number(item.amount) || 0;
        } else if (item.type === "הוצאה") {
          projectData[key].expense += Number(item.amount) || 0;
        }
      });
      const barData = Object.values(projectData);

      // Pie: Donations by SubType
      const donationData = data.filter((item) => item.type === "תרומה");
      const subTypeCount = {};
      donationData.forEach((item) => {
        const key = item.subType || "אחר";
        subTypeCount[key] = (subTypeCount[key] || 0) + (Number(item.amount) || 0);
      });
      const pieData = Object.entries(subTypeCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      return { barData, pieData };
    },
    transform: (item) => item,
  },

};

/* ============================================================
   PDF Export Function
   ============================================================ */
const exportToPDF = (report, rows, fields, filters, sort, options = {}) => {
  if (!rows.length) {
    alert("אין נתונים לייצוא");
    return;
  }

  const { fontSize = 14, landscape = false } = options;
  const pageSize = landscape ? "A4 landscape" : "A4 portrait";

  const cols = fields.map((k) => report.fields.find((f) => f.key === k)).filter(Boolean);
  const columnCount = cols.length;
  const today = new Date().toLocaleDateString("he-IL");

  let filterChips = "";
  const activeFilters = Object.entries(filters).filter(([, v]) => v && v !== "");
  if (activeFilters.length > 0) {
    filterChips = activeFilters
      .map(([k, v]) => {
        const label = report.filters.find((f) => f.key === k)?.label || k;
        return `${label}: ${v}`;
      })
      .join(" • ");
  }

  const tableRows = rows
    .map((r) => {
      return `<tr>${cols.map((c) => `<td>${r[c.key] == null || r[c.key] === "" ? "—" : String(r[c.key])}</td>`).join("")}</tr>`;
    })
    .join("");

  let summaryItems = "";
  if (report.id === "elderly") {
    const uniqueElderly = Array.from(
      new Map(rows.map((r) => [r.idNum || r.id, r])).values()
    );
    const active = uniqueElderly.filter((d) => d.status === "פעיל").length;
    const males = uniqueElderly.filter((d) => d.gender === "זכר").length;
    const females = uniqueElderly.filter((d) => d.gender === "נקבה").length;
    const archived = uniqueElderly.filter((d) => d.isArchived === "כן").length;

    summaryItems += `
      <div class="item">📊 סה"כ שורות (שיבוצים): <strong>${rows.length}</strong></div>
      <div class="item">👥 סה"כ אזרחים ייחודיים: <strong>${uniqueElderly.length}</strong></div>
      <div class="item">🟢 פעילים: <strong>${active}</strong></div>
      <div class="item">👴 גברים: <strong>${males}</strong></div>
      <div class="item">👵 נשים: <strong>${females}</strong></div>
    `;
    if (archived > 0) {
      summaryItems += `<div class="item">📦 בארכיב: <strong>${archived}</strong></div>`;
    }
  } else {
    summaryItems = `<div class="item">📊 סה"כ רשומות: <strong>${rows.length}</strong></div>`;
    const archived = rows.filter((d) => d.isArchived === "כן").length;
    if (archived > 0) {
      summaryItems += `<div class="item">📦 בארכיב: <strong>${archived}</strong></div>`;
    }

    if (report.id === "volunteers") {
      const active = rows.filter((d) => d.status === "פעיל").length;
      const pending = rows.filter((d) => d.status === "ממתין לשיבוץ").length;
      summaryItems += `
        <div class="item">🟢 פעילים: <strong>${active}</strong></div>
        <div class="item">⏳ ממתינים: <strong>${pending}</strong></div>
      `;
    } else if (report.id === "projects") {
      const completed = rows.filter((d) => d.status === "הסתיים" || d.status === "סיים").length;
      const active = rows.filter((d) => d.status === "פעיל").length;
      summaryItems += `
        <div class="item">✅ הסתיימו: <strong>${completed}</strong></div>
        <div class="item">🟢 פעילים: <strong>${active}</strong></div>
      `;
    } else if (report.id === "financial") {
      const incomes = rows.filter((d) => d.type === "תרומה" || d.type === "הכנסה");
      const expenses = rows.filter((d) => d.type === "הוצאה");
      const totalIn = incomes.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalOut = expenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      summaryItems += `
        <div class="item">💰 הכנסות: <strong>₪${totalIn.toLocaleString()}</strong></div>
        <div class="item">💸 הוצאות: <strong>₪${totalOut.toLocaleString()}</strong></div>
        <div class="item">📊 יתרה: <strong>₪${(totalIn - totalOut).toLocaleString()}</strong></div>
      `;
    } else if (report.id === "parliaments") {
      const totalMembers = rows.reduce((s, r) => s + (Number(r.members) || 0), 0);
      summaryItems += `
        <div class="item">👥 סה"כ משתתפים: <strong>${totalMembers}</strong></div>
      `;
    }
  }

  // Dynamic font size computation based on column count for landscape
  let computedFont = fontSize;
  if (columnCount > 6) {
    const diff = columnCount - 6;
    computedFont = Math.max(8, fontSize - diff);
  }
  const tableFontSize = Math.min(fontSize, computedFont);

  const html = `<!doctype html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>${report.label}</title>
  <style>
    @page { size: ${pageSize}; margin: 15mm 12mm; }
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
      font-size: ${tableFontSize}px;
      table-layout: fixed;
    }
    th {
      background: #8B0000;
      color: white;
      padding: 8px 4px;
      text-align: right;
      border: 1px solid #6b0000;
      font-weight: 600;
      word-wrap: break-word;
      word-break: break-word;
    }
    td {
      padding: 6px 4px;
      border: 1px solid #bbb;
      text-align: right;
      vertical-align: middle;
      word-wrap: break-word;
      word-break: break-word;
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
      font-size: 13px;
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
  ${sort ? `<div class="filter-info">📊 מיון: ${sort}</div>` : ""}
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
   Reports Grid (6 Cards)
   ============================================================ */
const ReportsGrid = ({ onOpen }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: 20,
      marginBottom: 28,
    }}
  >
    {Object.values(REPORT_TYPES).map((r) => (
      <div
        key={r.id}
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px 20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #f0e8e4",
          textAlign: "right",
          transition: "transform 0.2s, box-shadow 0.2s",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(139,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        }}
      >
        <div style={{ color: "#8B0000", marginBottom: 8 }}>{getReportIcon(r.icon, 36)}</div>
        <h3
          style={{
            color: "#8B0000",
            margin: "0 0 4px",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {r.label}
        </h3>
        <p
          style={{
            color: "#666",
            fontSize: 14,
            margin: "0 0 18px",
            minHeight: 40,
            lineHeight: 1.4,
          }}
        >
          {r.description}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => onOpen(r.id)}
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "auto",
            fontSize: "14px",
            background: "#8B0000",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          פתיחת דוח
        </button>
      </div>
    ))}
  </div>
);

// ============================================================
// CHART RENDER FUNCTIONS
// ============================================================

const renderElderlyCharts = (data) => {
  const { barData, pieData } = REPORT_TYPES.elderly.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 אזרחים ותיקים לפי שכונה">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8B0000" name="מספר אזרחים" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="🧩 התפלגות לפי סטטוס">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
};

const renderVolunteerCharts = (data) => {
  return <VolunteerCharts data={data} height={300} />;
};

const renderProjectCharts = (data) => {
  const { barData } = REPORT_TYPES.projects.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 כמות אזרחים ותיקים שקיבלו חבילה לפי פרויקטים">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="delivered" fill="#8B0000" name="אזרחים ותיקים שקיבלו חבילה" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
};

const renderParliamentCharts = (data) => {
  const { barData } = REPORT_TYPES.parliaments.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 מספר פגישות בפרלמנטים">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="meetings" fill="#7b1fa2" name="מספר פגישות שבוצעו" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
};

const renderJoinRequestCharts = (data) => {
  const { pieData } = REPORT_TYPES.joinRequests.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="🧩 התפלגות בקשות הצטרפות לפי סטטוס">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
};

const renderFinancialCharts = (data) => {
  const { barData, pieData } = REPORT_TYPES.financial.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 הכנסות מול הוצאות לפי פרויקט">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="income" fill="#2e7d32" name="הכנסות" />
            <Bar dataKey="expense" fill="#d32f2f" name="הוצאות" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="🧩 התפלגות תרומות לפי סוג">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
};



/* ============================================================
   Report Builder Component with Enhanced Filters + CHARTS
   ============================================================ */
const ReportBuilder = ({ reportKey, onBack }) => {
  const report = REPORT_TYPES[reportKey];
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [selectedFields, setSelectedFields] = useState(report.defaults);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [pdfFontSize, setPdfFontSize] = useState(14);
  const [pdfLandscape, setPdfLandscape] = useState(false);

  const handleFilterChange = (key, val) => {
    const newFilters = { ...filters, [key]: val };

    if (reportKey === "volunteers") {
      if (key === "volunteerType" && val !== "קבוצה") {
        delete newFilters.groupType;
        delete newFilters.group;
      }
      if (key === "groupType") {
        if (newFilters.group) {
          const isValidGroup = allData.some(
            (r) => r.group === newFilters.group && r.groupType === val
          );
          if (!isValidGroup) {
            delete newFilters.group;
          }
        }
      }
    }

    setFilters(newFilters);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await report.loadData();
        if (alive) {
          const transformed = data.map(report.transform);
          setAllData(transformed);
        }
      } catch (e) {
        console.error("Failed to load", report.collection, e);
        if (alive) {
          setAllData([]);
        }
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
      if (f.type === "select" && !f.options) {
        if (f.key === "projectGroup") {
          const allGroups = [];
          allData.forEach((r) => {
            if (r.groupList) allGroups.push(...r.groupList);
            else if (r.groupName) allGroups.push(r.groupName);
          });
          opts[f.key] = [...new Set(allGroups)].filter(Boolean);
        } else {
          let list = [...new Set(allData.map((r) => r[f.key]).filter(Boolean))];
          if (f.key === "groupName" && reportKey === "elderly") {
            if (!list.includes("עצמאיים")) {
              list.push("עצמאיים");
            }
          }
          opts[f.key] = list;
        }
      }
    });
    return opts;
  }, [allData, report, reportKey]);

  const filteredData = useMemo(() => {
    let result = allData.filter((row) => {
      return Object.entries(filters).every(([k, v]) => {
        if (!v || v === "") return true;
        if (k.endsWith("From") || k.endsWith("To")) {
          const baseKey = k.replace("From", "").replace("To", "");
          if (!row[baseKey]) return true;
          const rowDate = new Date(row[baseKey]);
          const filterDate = new Date(v);
          if (k.endsWith("From")) return rowDate >= filterDate;
          if (k.endsWith("To")) return rowDate <= filterDate;
        }
        if (k === "projectGroup") {
          if (reportKey === "elderly") {
            return row.groupName === v;
          }
          return row.groupList && row.groupList.includes(v);
        }
        return row[k] === v;
      });
    });

    if (sort) {
      const [key, direction] = sort.startsWith("-") ? [sort.slice(1), -1] : [sort, 1];
      result = [...result].sort((a, b) => {
        const aVal = a[key] || "";
        const bVal = b[key] || "";
        return direction * String(aVal).localeCompare(String(bVal), "he");
      });
    }

    return result;
  }, [allData, filters, sort]);

  const toggleField = (k) => setSelectedFields((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const renderFilterInput = (filter) => {
    const value = filters[filter.key] || "";

    if (filter.type === "date") {
      return (
        <input
          type="date"
          className="input"
          value={value}
          onChange={(e) => handleFilterChange(filter.key, e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 160 }}
        />
      );
    }

    if (filter.type === "select") {
      let options = filter.options || filterOptions[filter.key] || [];

      // Cascading logic for volunteers report
      if (reportKey === "volunteers") {
        if (filter.key === "groupType") {
          options = options.filter((o) => o !== "עצמאי");
        } else if (filter.key === "group") {
          const filteredGroups = allData
            .filter((r) => r.volunteerType === "קבוצה" && (!filters.groupType || r.groupType === filters.groupType))
            .map((r) => r.group)
            .filter(Boolean);
          options = [...new Set(filteredGroups)];
        }
      }

      return (
        <select
          className="select"
          value={value}
          onChange={(e) => handleFilterChange(filter.key, e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 160,
            background: "white",
            color: "#1a1a1a",
          }}
        >
          <option value="">
            {`כל ${filter.label}`}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }

    return null;
  };

  // ===== RENDER CHARTS BASED ON REPORT TYPE =====
  const renderCharts = () => {
    if (!filteredData.length) return null;

    switch (reportKey) {
      case "elderly":
        return null;
      case "volunteers":
        return renderVolunteerCharts(filteredData);
      case "projects":
        return renderProjectCharts(filteredData);
      case "parliaments":
        return renderParliamentCharts(filteredData);
      case "joinRequests":
        return renderJoinRequestCharts(filteredData);
      case "financial":
        return renderFinancialCharts(filteredData);
      default:
        return null;
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          className="btn"
          onClick={onBack}
          style={{
            padding: "8px 16px",
            background: "#f5f0ed",
            border: "1px solid #ddd",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            color: "#333",
          }}
        >
          → חזרה לדוחות
        </button>
        <h2 style={{ margin: 0, color: "#8B0000", fontSize: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
          {getReportIcon(report.icon, 24)} {report.label}
        </h2>
      </div>

      {/* ===== CHARTS SECTION ===== */}
      {!loading && renderCharts()}

      {/* Filters */}
      {report.filters.length > 0 && (
        <SectionCard title="סינון נתונים">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {report.filters.map((f) => {
              if (reportKey === "volunteers" && (f.key === "groupType" || f.key === "group")) {
                if (filters.volunteerType !== "קבוצה") {
                  return null;
                }
              }
              return (
                <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{f.label}</label>
                  {renderFilterInput(f)}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {Object.values(filters).some((v) => v && v !== "") && (
              <button
                className="btn"
                onClick={() => setFilters({})}
                style={{
                  padding: "8px 16px",
                  background: "#f5f0ed",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                נקה סינון
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* Sorting - FIXED */}
      {report.sortOptions && (
        <SectionCard title="מיון">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                minWidth: 200,
                background: "white",
                color: "#1a1a1a",
                fontSize: "14px",
              }}
            >
              <option value="">
                ללא מיון
              </option>
              {report.sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {sort && (
              <button
                className="btn"
                onClick={() => setSort("")}
                style={{
                  padding: "8px 16px",
                  background: "#f5f0ed",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                נקה מיון
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* Fields selector */}
      <SectionCard
        title={`בחירת עמודות (${selectedFields.length}/${report.fields.length})`}
        actions={
          <button
            className="btn"
            onClick={() => setShowFields((v) => !v)}
            style={{
              padding: "6px 14px",
              background: "#f5f0ed",
              border: "1px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {showFields ? "הסתר" : "הצג"}
          </button>
        }
      >
        {showFields && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => setSelectedFields(report.fields.map((f) => f.key))}
                style={{
                  padding: "6px 14px",
                  background: "#8B0000",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                בחר הכל
              </button>
              <button
                className="btn"
                onClick={() => setSelectedFields([])}
                style={{
                  padding: "6px 14px",
                  background: "#f5f0ed",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                נקה הכל
              </button>
              <button
                className="btn"
                onClick={() => setSelectedFields(report.defaults)}
                style={{
                  padding: "6px 14px",
                  background: "#f5f0ed",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                ברירת מחדל
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 8,
              }}
            >
              {report.fields.map((f) => (
                <label
                  key={f.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: selectedFields.includes(f.key) ? "#fff5f5" : "#fff",
                  }}
                >
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
        <button
          className="btn btn-primary"
          onClick={() => {
            const sortLabel = sort ? report.sortOptions?.find((o) => o.value === sort)?.label || sort : "";
            exportToPDF(report, filteredData, selectedFields, filters, sortLabel, {
              fontSize: pdfFontSize,
              landscape: pdfLandscape,
            });
          }}
          disabled={!filteredData.length || !selectedFields.length}
          style={{
            padding: "10px 20px",
            background: "#8B0000",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: filteredData.length && selectedFields.length ? "pointer" : "not-allowed",
            opacity: filteredData.length && selectedFields.length ? 1 : 0.6,
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          📄 ייצוא ל-PDF
        </button>

        {/* PDF Settings Panel */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "6px 16px",
            background: "#fdfbfa",
            border: "1px solid #e2d6cf",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="pdfFontSizeInput" style={{ fontWeight: 500, color: "#555" }}>PDF:</label>
            <input
              id="pdfFontSizeInput"
              type="number"
              min="10"
              max="20"
              value={pdfFontSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setPdfFontSize(Math.min(20, Math.max(10, val)));
                } else {
                  setPdfFontSize("");
                }
              }}
              onBlur={() => {
                if (pdfFontSize === "" || isNaN(pdfFontSize)) {
                  setPdfFontSize(14);
                }
              }}
              style={{
                width: "55px",
                padding: "4px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                textAlign: "center",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 500, color: "#555" }}>כיוון דף:</span>
            <select
              value={pdfLandscape ? "landscape" : "portrait"}
              onChange={(e) => setPdfLandscape(e.target.value === "landscape")}
              style={{
                padding: "4px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                background: "white",
                color: "#1a1a1a",
              }}
            >
              <option value="portrait">לאורך (Portrait)</option>
              <option value="landscape">לרוחב (Landscape)</option>
            </select>
          </div>
        </div>
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
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#8B0000", color: "white" }}>
                  {selectedFields.map((k) => {
                    const f = report.fields.find((x) => x.key === k);
                    return (
                      <th key={k} style={{ padding: "10px 8px", textAlign: "right", border: "1px solid #6b0000" }}>
                        {f?.label || k}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 50).map((row, i) => (
                  <tr key={`${row.id || ''}-${row.projectName || ''}-${row.groupName || ''}-${i}`} style={i % 2 === 0 ? { background: "white" } : { background: "#f9f6f4" }}>
                    {selectedFields.map((k) => (
                      <td key={k} style={{ padding: "8px 6px", border: "1px solid #ddd", textAlign: "right" }}>
                        {row[k] == null || row[k] === "" ? "—" : String(row[k])}
                      </td>
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
   Holiday Summary - Pure Firebase, No Seed
   ============================================================ */
const HolidaySummary = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [years, setYears] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getFinancialRecords();
        if (alive && data.length > 0) {
          setAllData(data);
          const yearSet = new Set();
          const projectSet = new Set();
          data.forEach((r) => {
            if (r.project) {
              projectSet.add(r.project);
              const yearMatch = r.project.match(/\d{4}/);
              if (yearMatch) {
                yearSet.add(yearMatch[0]);
              }
            }
          });
          const yearList = [...yearSet].sort();
          const projectList = [...projectSet].sort();
          setYears(yearList);
          setProjects(projectList);
          if (yearList.length > 0) setSelectedYear(yearList[0]);
          if (projectList.length > 0) setSelectedProject(projectList[0]);
        } else {
          setAllData([]);
        }
      } catch (e) {
        console.error("Failed to load financial data:", e);
        setAllData([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filteredData = useMemo(() => {
    let result = allData;
    if (selectedYear) {
      result = result.filter((r) => r.project && r.project.includes(selectedYear));
    }
    if (selectedProject) {
      result = result.filter((r) => r.project === selectedProject);
    }
    return result;
  }, [allData, selectedYear, selectedProject]);

  const incomes = filteredData.filter((r) => r.type === "תרומה");
  const expenses = filteredData.filter((r) => r.type === "הוצאה");

  const sum = (arr) => arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalIn = sum(incomes);
  const totalOut = sum(expenses);

  const exportHolidayPDF = () => {
    if (!filteredData.length) {
      alert("אין נתונים לייצוא");
      return;
    }

    const today = new Date().toLocaleDateString("he-IL");
    const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");
    const maxRows = Math.max(incomes.length, expenses.length, 5);

    const rowsHTML = Array.from({ length: maxRows })
      .map((_, i) => {
        const inc = incomes[i];
        const exp = expenses[i];
        return `<tr>
          <td>${inc ? inc.name || "—" : "&nbsp;"}</td>
          <td class="num">${inc ? fmt(inc.amount) : "&nbsp;"}</td>
          <td>${exp ? exp.name || "—" : "&nbsp;"}</td>
          <td class="num">${exp ? fmt(exp.amount) : "&nbsp;"}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>סיכום ${selectedProject || "כספי"}</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", "David", sans-serif; color: #111; margin: 0; }
  .date-top { text-align: left; font-size: 13px; color: #555; margin-bottom: 6px; border-bottom: 2px solid #8B0000; padding-bottom: 6px; }
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
<div class="sub-title">סיכום הכנסות והוצאות - ${selectedProject || "כל הפרויקטים"} ${selectedYear ? `(${selectedYear})` : ""}</div>
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
    if (!w) {
      alert("נא לאפשר חלונות קופצים בדפדפן");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>טוען נתונים...</div>;
  }

  if (!allData.length) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            className="btn"
            onClick={onBack}
            style={{
              padding: "8px 16px",
              background: "#f5f0ed",
              border: "1px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            → חזרה
          </button>
          <h2 style={{ margin: 0, color: "#8B0000" }}>🎄 סיכום הכנסות והוצאות לפי חג</h2>
        </div>
        <SectionCard>
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>אין נתונים כספיים במערכת</div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          className="btn"
          onClick={onBack}
          style={{
            padding: "8px 16px",
            background: "#f5f0ed",
            border: "1px solid #ddd",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            color: "#333",
          }}
        >
          → חזרה
        </button>
        <h2 style={{ margin: 0, color: "#8B0000" }}>🎄 סיכום הכנסות והוצאות לפי חג</h2>
      </div>

      <SectionCard title="בחירת שנה ופרויקט">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>שנה</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                minWidth: 150,
                background: "white",
                color: "#1a1a1a",
              }}
            >
              <option value="">כל השנים</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>פרויקט / חג</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                minWidth: 200,
                background: "white",
                color: "#1a1a1a",
              }}
            >
              <option value="">כל הפרויקטים</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={exportHolidayPDF}
            disabled={!filteredData.length}
            style={{
              padding: "8px 20px",
              background: "#8B0000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: filteredData.length ? "pointer" : "not-allowed",
              opacity: filteredData.length ? 1 : 0.6,
            }}
          >
            📄 ייצוא ל-PDF
          </button>

          <div style={{ marginInlineStart: "auto", color: "#666" }}>
            {filteredData.length} רשומות • הכנסות: {totalIn.toLocaleString("he-IL")} ₪ • הוצאות:{" "}
            {totalOut.toLocaleString("he-IL")} ₪
          </div>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <SectionCard title={`הכנסות (${incomes.length})`}>
          {incomes.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>אין הכנסות</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#8B0000", color: "white" }}>
                  <th style={{ padding: "8px", textAlign: "right", border: "1px solid #6b0000" }}>שם</th>
                  <th style={{ padding: "8px", textAlign: "right", border: "1px solid #6b0000", width: 120 }}>סכום</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((r, i) => (
                  <tr key={r.id || i} style={i % 2 === 0 ? { background: "white" } : { background: "#f9f6f4" }}>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{r.name || "—"}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {(Number(r.amount) || 0).toLocaleString("he-IL")} ₪
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: "#f5f0ed" }}>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>סה"כ</td>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>{totalIn.toLocaleString("he-IL")} ₪</td>
                </tr>
              </tbody>
            </table>
          )}
        </SectionCard>
        <SectionCard title={`הוצאות (${expenses.length})`}>
          {expenses.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>אין הוצאות</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#8B0000", color: "white" }}>
                  <th style={{ padding: "8px", textAlign: "right", border: "1px solid #6b0000" }}>שם</th>
                  <th style={{ padding: "8px", textAlign: "right", border: "1px solid #6b0000", width: 120 }}>סכום</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((r, i) => (
                  <tr key={r.id || i} style={i % 2 === 0 ? { background: "white" } : { background: "#f9f6f4" }}>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{r.name || "—"}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {(Number(r.amount) || 0).toLocaleString("he-IL")} ₪
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: "#f5f0ed" }}>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>סה"כ</td>
                  <td style={{ padding: "8px", border: "1px solid #ddd" }}>{totalOut.toLocaleString("he-IL")} ₪</td>
                </tr>
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </>
  );
};

// Donations Summary - Pure Firebase, No Seed
const DONATION_TYPES = ["העברה ביט", "העברה במזומן", "העברה מנגלה קהילתי גילה"];

const DonationsSummary = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getFinancialRecords();
        if (alive) {
          setRows(data.filter((r) => r.type === "תרומה"));
        }
      } catch (e) {
        console.error("Failed to load financial data:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const groups = DONATION_TYPES.map((type) => ({
    type,
    items: rows.filter((r) => r.subType === type),
  }));

  const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

  const printPDF = (selectedTypes) => {
    const chosen = groups.filter((g) => selectedTypes.includes(g.type));
    if (!chosen.some((g) => g.items.length)) {
      alert("אין נתונים לייצוא");
      return;
    }

    const today = new Date().toLocaleDateString("he-IL");
    const title = selectedTypes.length === 1 ? `סיכום תרומות — ${selectedTypes[0]}` : "סיכום תרומות";
    const grandTotal = chosen.reduce((s, g) => s + g.items.reduce((a, r) => a + (Number(r.amount) || 0), 0), 0);

    const buildGroupTable = (g) => {
      const total = g.items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const body = g.items.length
        ? g.items
            .map(
              (r) => `<tr>
            <td>${r.name || "—"}</td>
            <td class="num">${fmt(r.amount)} ₪</td>
            <td>${(r.receiptType || "").includes("46") ? "" : "✔"}</td>
            <td>${(r.receiptType || "").includes("46") ? "✔" : ""}</td>
          </tr>`,
            )
            .join("")
        : `<tr><td colspan="4" style="text-align:center;color:#888;">אין נתונים</td></tr>`;
      return `
        <h3 class="grp-title">${g.type}</h3>
        <table>
          <thead><tr><th>שם</th><th>סכום</th><th>קבלה רגילה</th><th>קבלה 46</th></tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td>סה"כ</td><td class="num">${fmt(total)} ₪</td><td colspan="2"></td></tr></tfoot>
        </table>`;
    };

    const html = `<!doctype html>
<html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", "David", sans-serif; color: #111; margin: 0; }
  .date-top { text-align: left; font-size: 13px; color: #555; margin-bottom: 6px; border-bottom: 2px solid #8B0000; padding-bottom: 6px; }
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
    if (!w) {
      alert("נא לאפשר חלונות קופצים בדפדפן");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>טוען נתונים...</div>;

  const grandTotal = groups.reduce((s, g) => s + g.items.reduce((a, r) => a + (Number(r.amount) || 0), 0), 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          className="btn"
          onClick={onBack}
          style={{
            padding: "8px 16px",
            background: "#f5f0ed",
            border: "1px solid #ddd",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            color: "#333",
          }}
        >
          → חזרה
        </button>
        <h2 style={{ margin: 0, color: "#8B0000" }}>❤️ סיכום תרומות</h2>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => printPDF(DONATION_TYPES)}
            style={{
              padding: "8px 20px",
              background: "#8B0000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            📄 ייצוא PDF — כל הסוגים
          </button>
        </div>
      </div>

      {!rows.length ? (
        <SectionCard>
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>אין תרומות במערכת</div>
        </SectionCard>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {groups.map((g) => {
              const total = g.items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
              return (
                <SectionCard
                  key={g.type}
                  title={`${g.type} (${g.items.length})`}
                  actions={
                    <button
                      className="btn btn-primary"
                      onClick={() => printPDF([g.type])}
                      disabled={!g.items.length}
                      style={{
                        padding: "6px 14px",
                        background: "#8B0000",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: g.items.length ? "pointer" : "not-allowed",
                        opacity: g.items.length ? 1 : 0.6,
                        fontSize: "12px",
                      }}
                    >
                      📄 PDF
                    </button>
                    /*
                    דוחות:
    • מצב ארכיב- להוריד
    • בחירת עמודות- אפשר להוריד תאריך מחיקה
    • גודל פונט להגדיל ל14 – אם אפשר להגדיר בעת ההוצאה לPDF את גדול הפונט זה יהיה טוב
    • לבדוק הוצאה לPDF לצורה רוחבית כדי שיהיה אפשר להכניס מספר רב יותר של עמודות 
    • יציאה לpdf- יש למטה סיכום נתונים אז לשנות מ"זכרית/נקבות" ל"גברים/נשים"
דוחות מתנדבים:
גרפים- גם פה אפשר שיופיע בראש העמוד של ניהול מתנדבים 
    • להוסיף אפשרות לסינון או מיון לפי סוג הקבוצה
    • יש 2 סוגי מתנדבים: עצמאי או קבוצה
    • בתוך הקבוצות יש מגוון של קבוצות וצריך את האופציה לראות רשימה של קבוצה מסוימת 
    • אפשר להוריד בעמודות את תאריך המחיקה וארכיב
דוח פרויקטים-
    • גרף- מעולה, שיופיע בציר X את הפרויקטים בסדר כרונולוגי לאורך השנים, ובציר Y  את כמות האזרחים ותיקים שקיבלו חבילה
    • סינון- חג- לשנות, לשנות ל"פרויקט"
    • מצב ארכיב- אפשר להוריד
    • מספר א.ו- אפשר לכתוב אזרחים ותיקים
פרויקטים
    • להפעיל כפתור הדפסת רשימה
דוח פרויקטים-
    • להוסיף סינון לפי קבוצות (חברת חשמל, בית ספר..)
שאוכל להוציא רשימה של אזרחים ותיקים בפוריקט ספציפי לפי הקבוצה שמחלקת לו. 
    • עצמאיים זה גם קבוצה..
דוח פרלמנטים
    • גרף פרלמנטים- ציר X  זה שמות הפרלמנטים, ציר Y מספר הפגישות שנעשו בפרלמנט הזה
אפשר להעביר לחלק ניהול הפרלמנטים
    • סינונים- להוסיף גם סינון שכונה
    • מצב ארכיב אפשר להוריד
    • ליצור כפתורי הדפסה מתאימים לייצוא דוחות פרלמנט:
להוסיף אופציה לראות מידע על פרלמנט ספציפי (רשימת משתתפים בפרלמנט, או דוח אחר של מספר הפגישות והמידע של פרלמנט ספצפי)








כמו המידע שמופיע פה- רשימות משתתפים/רשימות הפגישות
    • מחיקת משתתף בפרלמנט- שהנתונים שלו יישמרו לדוגמא בפגישות 1 ו-2, אבל מפגישה 3 הוא יימחק ואני אוכל להכניס משתתף חדש 
דוחות בקשת הצטרפות-
להוסיף את כל העמודות (שם מלא, טלפון, הערות, סוג פניה, אימייל- להוסיף אימייל בבקשת הצטרפות בלי חובה למלא את המייל בשביל לשלוח את הבקשה)
דוחות כספיים:
    • לחבר לחלק ניהול הכספים
    • סיכום הכנסות והוצאות לפי חג- לא חייב באותו מסמך, 
    • ליצור כמו דוח כפסי כללי- לכל פרויקט 
    • להוסיף אופציה של סינון של 2 סוגי קבלות: קבלה רגילה וקבלה 46 (החזר לעסקים מסוימים/מעל סכום מסוים) וגם שיופיע באפשרות הדפסה של זה
אם אפשר להוסיף הוצאה לדוחות של ארגונים ואנשי קשר-
כמו הדוחות האחרים שיש אפשרות בחירת עמודות, בד"כ אוציא את כל העמודות 
אם אפשר לבחור שיופיעו כל אנשי הקשר של הארגון --- השלמה אחרי שאסתכל באתר 
לעבור על אנשי קשר לאזרחים הותיקים לראות שיש הכל 

                    */
                  }
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f5f0ed" }}>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>שם</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>סכום</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>קבלה רגילה</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>קבלה 46</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: "center", color: "#888", padding: "20px" }}>
                            אין נתונים
                          </td>
                        </tr>
                      ) : (
                        g.items.map((r, i) => (
                          <tr key={r.id || i} style={i % 2 === 0 ? { background: "white" } : { background: "#f9f6f4" }}>
                            <td style={{ padding: "8px", border: "1px solid #ddd" }}>{r.name || "—"}</td>
                            <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                              {(Number(r.amount) || 0).toLocaleString("he-IL")} ₪
                            </td>
                            <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                              {(r.receiptType || "").includes("46") ? "" : "✔"}
                            </td>
                            <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                              {(r.receiptType || "").includes("46") ? "✔" : ""}
                            </td>
                          </tr>
                        ))
                      )}
                      <tr style={{ fontWeight: 700, background: "#f5f0ed" }}>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>סה"כ</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{total.toLocaleString("he-IL")} ₪</td>
                        <td colSpan="2" style={{ padding: "8px", border: "1px solid #ddd" }}></td>
                      </tr>
                    </tbody>
                  </table>
                </SectionCard>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#f5f0ed",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            סה"כ תרומות בכל הסוגים: <span style={{ color: "#8B0000" }}>{grandTotal.toLocaleString("he-IL")} ₪</span>
          </div>
        </>
      )}
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
  if (mode === "holiday") return <HolidaySummary onBack={() => setMode(null)} />;
  if (mode === "donations") return <DonationsSummary onBack={() => setMode(null)} />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          className="btn"
          onClick={onBack}
          style={{
            padding: "8px 16px",
            background: "#f5f0ed",
            border: "1px solid #ddd",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            color: "#333",
          }}
        >
          → חזרה לדוחות
        </button>
        <button
          className="btn"
          onClick={async () => {
            if (confirm("האם ברצונך לייצר נתוני סימולציה לבדיקת הדוחות הכספיים?")) {
              try {
                await seedFinancialDummyData();
                alert("נתוני הסימולציה נוצרו בהצלחה! יש לרענן את העמוד.");
                window.location.reload();
              } catch (err) {
                console.error(err);
                alert("שגיאה ביצירת הנתונים: " + err.message);
              }
            }
          }}
          style={{
            padding: "8px 16px",
            background: "#fff5f5",
            border: "1px solid #ffcccc",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            color: "#8B0000",
            fontWeight: "bold",
          }}
        >
          ⚙️ יצירת נתוני סימולציה
        </button>
        <h2 style={{ margin: 0, color: "#8B0000", display: "flex", alignItems: "center", gap: "8px", marginInlineStart: "auto" }}>
          <Coins size={24} /> דוחות כספיים
        </h2>
      </div>
      <p style={{ color: "#666", margin: "0 0 20px" }}>בחר את סוג הדוח שברצונך להפיק ולייצא ל-PDF:</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {FINANCIAL_SUBREPORTS.map((r) => (
          <div
            key={r.key}
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px 20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #f0e8e4",
              textAlign: "right",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(139,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            }}
          >
            <div style={{ color: "#8B0000", marginBottom: 8 }}>{getReportIcon(r.icon, 36)}</div>
            <h3 style={{ color: "#8B0000", margin: "0 0 4px", fontSize: 18 }}>{r.label}</h3>
            <p style={{ color: "#666", fontSize: 14, margin: "0 0 18px", minHeight: 52, lineHeight: 1.4 }}>
              {r.description}
            </p>
            <button
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "auto",
                fontSize: "14px",
                background: "#8B0000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
              onClick={() => setMode(r.key)}
            >
              פתיחה
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

/* ============================================================
   Main Export - No QuickStats, Pure Firebase
   ============================================================ */
export default function Reports() {
  const [active, setActive] = useState(null);

  return (
    <AdminPageLayout heroImage="/admin-heroes/reports_hero.png" title="דוחות" subtitle="נתונים וסטטיסטיקות מהמערכת">
      {active ? (
        active === "financial" ? (
          <FinancialChooser onBack={() => setActive(null)} />
        ) : (
          <ReportBuilder reportKey={active} onBack={() => setActive(null)} />
        )
      ) : (
        <ReportsGrid onOpen={setActive} />
      )}
    </AdminPageLayout>
  );
}
