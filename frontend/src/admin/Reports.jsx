// src/admin/Reports.jsx
import { useState, useEffect, useMemo } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { getElderly } from "@/services/elderlyService.js";
import { getVolunteers } from "@/services/volunteersService.js";
import { getParliaments } from "@/services/parliamentsService.js";

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

/* ============================================================
   REPORT DEFINITIONS - All data comes from Firebase only
   No SEED data - pure Firestore connection
   ============================================================ */
const REPORT_TYPES = {
  elderly: {
    id: "elderly",
    icon: "👵",
    label: "דוח אזרחים ותיקים",
    description: "פילוח לפי שכונה, אזור וסטטוס - כולל ארכיב",
    collection: "elderly",
    loadData: async () => {
      try {
        const data = await getElderly();
        return data || [];
      } catch (error) {
        console.error("Failed to load elderly from Firestore:", error);
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
      { key: "isArchived", label: "בארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "gender", "address", "mobile", "contactPhone", "lastContact", "notes", "birth"],
    filters: [
      { key: "gender", label: "מגדר", type: "select", options: ["זכר", "נקבה"] },
      { key: "neighborhood", label: "שכונה", type: "select" },
      { key: "area", label: "אזור", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["פעיל", "נפטר", "לא פעיל"] },
      { key: "volStatus", label: "סטטוס מתנדב", type: "select", options: ["כן", "לא מתאים", "לא רוצה"] },
      { key: "parliament", label: "פרלמנט", type: "select" },
      { key: "isArchived", label: "מצב ארכיב", type: "select", options: ["כן", "לא"] },
      { key: "lastContactFrom", label: "תאריך יצירת קשר אחרון - מ", type: "date" },
      { key: "lastContactTo", label: "תאריך יצירת קשר אחרון - עד", type: "date" },
      { key: "birthFrom", label: "תאריך לידה - מ", type: "date" },
      { key: "birthTo", label: "תאריך לידה - עד", type: "date" },
    ],
    sortOptions: [
      { value: "name", label: "שם (א-ב)" },
      { value: "-name", label: "שם (ב-א)" },
      { value: "neighborhood", label: "שכונה" },
      { value: "lastContact", label: "תאריך יצירת קשר אחרון" },
      { value: "birth", label: "תאריך לידה" },
      { value: "status", label: "סטטוס" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Bar: Elderly by Neighborhood
      const neighborhoodCount = {};
      data.forEach((item) => {
        const key = item.neighborhood || "ללא שכונה";
        neighborhoodCount[key] = (neighborhoodCount[key] || 0) + 1;
      });
      const barData = Object.entries(neighborhoodCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Pie: Elderly by Status
      const statusCount = {};
      data.forEach((item) => {
        const key = item.status || "ללא סטטוס";
        statusCount[key] = (statusCount[key] || 0) + 1;
      });
      const pieData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

      return { barData, pieData };
    },
    transform: (item) => ({
      ...item,
      name: `${item.firstName || ""} ${item.lastName || ""}`.trim() || item.name || "",
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: item.deletedAt || "",
    }),
  },
  volunteers: {
    id: "volunteers",
    icon: "🤝",
    label: "דוח מתנדבים",
    description: "סטטוס, קבוצות, שיבוצים - כולל ארכיב",
    collection: "volunteers",
    loadData: async () => {
      try {
        const data = await getVolunteers();
        return data || [];
      } catch (error) {
        console.error("Failed to load volunteers from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם מלא" },
      { key: "phone", label: "טלפון" },
      { key: "group", label: "קבוצה" },
      { key: "status", label: "סטטוס" },
      { key: "assigned", label: "משויך לאזרח" },
      { key: "start", label: "תאריך התחלה" },
      { key: "end", label: "תאריך סיום" },
      { key: "area", label: "אזור" },
      { key: "neighborhood", label: "שכונה" },
      { key: "address", label: "כתובת" },
      { key: "type", label: "סוג מתנדב" },
      { key: "insurance", label: "ביטוח" },
      { key: "notes", label: "הערות" },
      { key: "isArchived", label: "בארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "phone", "group", "status", "assigned", "start"],
    filters: [
      { key: "group", label: "קבוצה", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["פעיל", "ממתין לשיבוץ", "לא פעיל"] },
      { key: "area", label: "אזור", type: "select" },
      { key: "neighborhood", label: "שכונה", type: "select" },
      { key: "type", label: "סוג מתנדב", type: "select", options: ["סטודנט", "תלמיד", "עצמאי", "ארגון", "תרבות"] },
      { key: "insurance", label: "ביטוח", type: "select", options: ["כן", "לא"] },
      { key: "isArchived", label: "מצב ארכיב", type: "select", options: ["כן", "לא"] },
      { key: "startFrom", label: "תאריך התחלה - מ", type: "date" },
      { key: "startTo", label: "תאריך התחלה - עד", type: "date" },
    ],
    sortOptions: [
      { value: "name", label: "שם (א-ב)" },
      { value: "-name", label: "שם (ב-א)" },
      { value: "group", label: "קבוצה" },
      { value: "status", label: "סטטוס" },
      { value: "start", label: "תאריך התחלה" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Bar: Volunteers by Group
      const groupCount = {};
      data.forEach((item) => {
        const key = item.group || "ללא קבוצה";
        groupCount[key] = (groupCount[key] || 0) + 1;
      });
      const barData = Object.entries(groupCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Pie: Volunteers by Status
      const statusCount = {};
      data.forEach((item) => {
        const key = item.status || "ללא סטטוס";
        statusCount[key] = (statusCount[key] || 0) + 1;
      });
      const pieData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

      return { barData, pieData };
    },
    transform: (item) => ({
      ...item,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: item.deletedAt || "",
    }),
  },
  projects: {
    id: "projects",
    icon: "🎁",
    label: "דוח פרויקטים",
    description: "התקדמות, מסירות ובעיות - כולל ארכיב",
    collection: "projects",
    loadData: async () => {
      try {
        const snap = await getDocs(collection(db, "projects"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return data || [];
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
      { key: "elderly", label: "מספר א.ו." },
      { key: "assigned", label: "שובצו" },
      { key: "delivered", label: "נמסרו" },
      { key: "issues", label: "בעיות" },
      { key: "status", label: "סטטוס" },
      { key: "isArchived", label: "בארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "holiday", "year", "status", "elderly", "delivered"],
    filters: [
      { key: "holiday", label: "חג", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["מתוכנן", "בהכנה", "פעיל", "הסתיים"] },
      { key: "year", label: "שנה", type: "select" },
      { key: "isArchived", label: "מצב ארכיב", type: "select", options: ["כן", "לא"] },
    ],
    sortOptions: [
      { value: "name", label: "שם" },
      { value: "year", label: "שנה" },
      { value: "status", label: "סטטוס" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Bar: Project Progress
      const barData = data
        .map((item) => {
          const progress = item.elderly ? Math.round((item.delivered / item.elderly) * 100) : 0;
          return {
            name: item.name || "ללא שם",
            progress: progress,
            delivered: item.delivered || 0,
            total: item.elderly || 0,
          };
        })
        .sort((a, b) => b.progress - a.progress);

      return { barData };
    },
    transform: (item) => ({
      ...item,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: item.deletedAt || "",
      progress: item.elderly ? Math.round((item.delivered / item.elderly) * 100) : 0,
    }),
  },
  parliaments: {
    id: "parliaments",
    icon: "🏛️",
    label: "דוח פרלמנטים",
    description: "השתתפות ונוכחות - כולל ארכיב",
    collection: "parliaments",
    loadData: async () => {
      try {
        const data = await getParliaments();
        return data || [];
      } catch (error) {
        console.error("Failed to load parliaments from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם הפרלמנט" },
      { key: "location", label: "מיקום" },
      { key: "area", label: "אזור" },
      { key: "coordinators", label: "מלווים" },
      { key: "members", label: "משתתפים" },
      { key: "nextDate", label: "מפגש הבא" },
      { key: "status", label: "סטטוס" },
      { key: "notes", label: "הערות" },
      { key: "isArchived", label: "בארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "location", "area", "members", "nextDate", "status"],
    filters: [
      { key: "area", label: "אזור", type: "select" },
      { key: "status", label: "סטטוס", type: "select", options: ["פעיל", "בהכנה", "הסתיים"] },
      { key: "isArchived", label: "מצב ארכיב", type: "select", options: ["כן", "לא"] },
    ],
    sortOptions: [
      { value: "name", label: "שם" },
      { value: "area", label: "אזור" },
      { value: "status", label: "סטטוס" },
      { value: "nextDate", label: "תאריך מפגש" },
    ],
    // ===== CHART DATA =====
    getChartData: (data) => {
      // Bar: Parliament Members
      const barData = data
        .map((item) => ({
          name: item.name || "ללא שם",
          members: item.members || 0,
        }))
        .sort((a, b) => b.members - a.members);

      return { barData };
    },
    transform: (item) => ({
      ...item,
      coordinators: (item.coordinators || []).join(", "),
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: item.deletedAt || "",
    }),
  },
  joinRequests: {
    id: "joinRequests",
    icon: "✉️",
    label: "דוח בקשות הצטרפות",
    description: "בקשות וטיפול - כולל ארכיב",
    collection: "joinRequests",
    loadData: async () => {
      try {
        const snap = await getDocs(collection(db, "joinRequests"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return data || [];
      } catch (error) {
        console.error("Failed to load join requests from Firestore:", error);
        return [];
      }
    },
    fields: [
      { key: "name", label: "שם" },
      { key: "note", label: "פירוט" },
      { key: "status", label: "סטטוס" },
      { key: "isArchived", label: "בארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["name", "note", "status"],
    filters: [
      { key: "status", label: "סטטוס", type: "select", options: ["חדש", "בטיפול", "טופל"] },
      { key: "isArchived", label: "מצב ארכיב", type: "select", options: ["כן", "לא"] },
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
    transform: (item) => ({
      ...item,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: item.deletedAt || "",
    }),
  },
  financial: {
    id: "financial",
    icon: "💰",
    label: "דוח כספי",
    description: "הכנסות, הוצאות ותרומות - כולל ארכיב",
    collection: "financial",
    loadData: async () => {
      try {
        const snap = await getDocs(collection(db, "financial"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      { key: "isArchived", label: "בארכיב" },
      { key: "deletedAt", label: "תאריך מחיקה" },
    ],
    defaults: ["type", "name", "amount", "date", "project"],
    filters: [
      { key: "type", label: "סוג", type: "select", options: ["תרומה", "הוצאה"] },
      { key: "project", label: "פרויקט", type: "select" },
      { key: "isArchived", label: "מצב ארכיב", type: "select", options: ["כן", "לא"] },
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
    transform: (item) => ({
      ...item,
      isArchived: item.isArchived ? "כן" : "לא",
      deletedAt: item.deletedAt || "",
    }),
  },
};

/* ============================================================
   PDF Export Function
   ============================================================ */
const exportToPDF = (report, rows, fields, filters, sort) => {
  if (!rows.length) {
    alert("אין נתונים לייצוא");
    return;
  }

  const cols = fields.map((k) => report.fields.find((f) => f.key === k)).filter(Boolean);
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

  let summaryItems = `<div class="item">📊 סה"כ רשומות: <strong>${rows.length}</strong></div>`;
  const archived = rows.filter((d) => d.isArchived === "כן").length;
  if (archived > 0) {
    summaryItems += `<div class="item">📦 בארכיב: <strong>${archived}</strong></div>`;
  }

  if (report.id === "elderly") {
    const active = rows.filter((d) => d.status === "פעיל").length;
    const males = rows.filter((d) => d.gender === "זכר").length;
    const females = rows.filter((d) => d.gender === "נקבה").length;
    summaryItems += `
      <div class="item">🟢 פעילים: <strong>${active}</strong></div>
      <div class="item">👴 זכרים: <strong>${males}</strong></div>
      <div class="item">👵 נקבות: <strong>${females}</strong></div>
    `;
  } else if (report.id === "volunteers") {
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
      font-size: 12px;
    }
    th {
      background: #8B0000;
      color: white;
      padding: 8px 6px;
      text-align: right;
      border: 1px solid #6b0000;
      font-weight: 600;
    }
    td {
      padding: 6px;
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
        <div style={{ fontSize: 36, marginBottom: 8 }}>{r.icon}</div>
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
  const { barData, pieData } = REPORT_TYPES.volunteers.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 מתנדבים לפי קבוצה">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#D4A574" name="מספר מתנדבים" />
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

const renderProjectCharts = (data) => {
  const { barData } = REPORT_TYPES.projects.getChartData(data);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 התקדמות פרויקטים (אחוז מסירות)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend />
            <Bar dataKey="progress" fill="#2e7d32" name="התקדמות (%)" />
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
      <SectionCard title="📊 מספר משתתפים בפרלמנטים">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="members" fill="#7b1fa2" name="מספר משתתפים" />
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
        opts[f.key] = [...new Set(allData.map((r) => r[f.key]).filter(Boolean))];
      }
    });
    return opts;
  }, [allData, report]);

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
          onChange={(e) => setFilters({ ...filters, [filter.key]: e.target.value })}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 160 }}
        />
      );
    }

    if (filter.type === "select") {
      const options = filter.options || filterOptions[filter.key] || [];
      return (
        <select
          className="select"
          value={value}
          onChange={(e) => setFilters({ ...filters, [filter.key]: e.target.value })}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", minWidth: 160, background: "white" }}
        >
          <option value="">{`כל ${filter.label}`}</option>
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
        return renderElderlyCharts(filteredData);
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
        <h2 style={{ margin: 0, color: "#8B0000", fontSize: "22px" }}>
          {report.icon} {report.label}
        </h2>
      </div>

      {/* ===== CHARTS SECTION ===== */}
      {!loading && renderCharts()}

      {/* Filters */}
      {report.filters.length > 0 && (
        <SectionCard title="סינון נתונים">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {report.filters.map((f) => (
              <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{f.label}</label>
                {renderFilterInput(f)}
              </div>
            ))}
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
                color: sort ? "#1a1a1a" : "#666",
                fontSize: "14px",
              }}
            >
              <option value="" style={{ color: "#666" }}>
                ללא מיון
              </option>
              {report.sortOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ color: "#1a1a1a" }}>
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
            exportToPDF(report, filteredData, selectedFields, filters, sortLabel);
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
          }}
        >
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
                  <tr key={row.id || i} style={i % 2 === 0 ? { background: "white" } : { background: "#f9f6f4" }}>
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
        const snap = await getDocs(collection(db, "financial"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
        const snap = await getDocs(collection(db, "financial"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
        <h2 style={{ margin: 0, color: "#8B0000" }}>💰 דוחות כספיים</h2>
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>{r.icon}</div>
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
