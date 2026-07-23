import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";
import "./styles/public.css";
import "./styles/admin.css";
import "./styles/volunteer.css";
import "./styles/Login.css";

import Home from "./pages/Home.jsx";
import ActivityDetail from "./pages/ActivityDetail.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import PublicGallery from "./pages/PublicGallery.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Dashboard from "./admin/Dashboard.jsx";
import Elderly from "./admin/Elderly.jsx";
import ElderlyProfile from "./admin/ElderlyProfile.jsx";
import Volunteers from "./admin/Volunteers.jsx";
import Projects from "./admin/Projects.jsx";
import Parliaments from "./admin/Parliaments.jsx";
import Media from "./admin/Media.jsx";
import Links from "./admin/Links.jsx";
import Financial from "./admin/Financial.jsx";
import Reports from "./admin/Reports.jsx";
import VolunteerReports from "./admin/VolunteerReports.jsx";
import Settings from "./admin/Settings.jsx";
import SiteContent from "./admin/SiteContent.jsx";
import ProfileUpdateRequests from "./admin/ProfileUpdateRequests.jsx";
import ElderlyContacts from "./admin/ElderlyContacts.jsx";
import Organizations from "./admin/Organizations.jsx";
import AdminProfile from "./pages/AdminProfile.jsx";
import RequireReauth from "./components/RequireReauth.jsx";

const SITE_CONTENT_DESC = "אזור זה שולט בתוכן האתר הציבורי — טקסטים בדף הבית, שותפים, כותרות גלריה, תוכן יצירת קשר ומידע הפוטר. שינויים כאן עלולים להשפיע על מה שהמבקרים רואים באתר הציבורי.";
const SETTINGS_DESC = "אזור זה שולט בהגדרות המערכת, משתמשים, הרשאות ונתוני ניהול חשובים. שינויים כאן עלולים להשפיע על גישה ועל התנהגות המערכת.";


import VolunteerDashboard from "./volunteer/VolunteerDashboard.jsx";
import VolunteerReportForm from "./volunteer/VolunteerReportForm.jsx";
import VolunteerReportsHistory from "./volunteer/VolunteerReportsHistory.jsx";
import VolunteerTasks from "./volunteer/VolunteerTasks.jsx";
import VolunteerProfile from "./volunteer/VolunteerProfile.jsx";
import PublicAutoLogout from "./components/PublicAutoLogout.jsx";

const Admin = ({ children }) => (
  <ProtectedRoute allow={["admin"]}>{children}</ProtectedRoute>
);
const Vol = ({ children }) => (
  <ProtectedRoute allow={["volunteer", "admin"]}>{children}</ProtectedRoute>
);

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const getPageTitle = (pathname) => {
      const base = "פרויקט מתחברים";
      
      // Exact matches
      if (pathname === "/") return `${base} — חיבור אזרחים בודדים לקהילה`;
      if (pathname === "/login") return `התחברות | ${base}`;
      if (pathname === "/forgot-password") return `איפוס סיסמה | ${base}`;
      if (pathname === "/public-gallery") return `גלריית תמונות | ${base}`;
      
      // Dynamic matches
      if (pathname.startsWith("/our-work/")) return `פרטי פעילות | ${base}`;
      
      // Admin section
      if (pathname === "/admin") return `לוח בקרה מנהל | ${base}`;
      if (pathname === "/admin/elderly") return `ניהול אזרחים ותיקים | ${base}`;
      if (pathname === "/admin/elderly-contacts") return `אנשי קשר אזרחים ותיקים | ${base}`;
      if (pathname.startsWith("/admin/elderly/")) return `פרופיל אזרח ותיק | ${base}`;
      if (pathname === "/admin/volunteers") return `ניהול מתנדבים | ${base}`;
      if (pathname === "/admin/organizations-contacts") return `אנשי קשר ארגונים | ${base}`;
      if (pathname === "/admin/projects") return `ניהול פרויקטים | ${base}`;
      if (pathname === "/admin/parliaments") return `ניהול פרלמנטים | ${base}`;
      if (pathname === "/admin/media") return `ניהול מדיה | ${base}`;
      if (pathname === "/admin/links") return `ניהול קישורים | ${base}`;
      if (pathname === "/admin/financial") return `ניהול פיננסי | ${base}`;
      if (pathname === "/admin/reports") return `דוחות מנהל | ${base}`;
      if (pathname === "/admin/volunteer-reports") return `דוחות פעילות מתנדבים | ${base}`;
      if (pathname === "/admin/settings") return `הגדרות מערכת | ${base}`;
      if (pathname === "/admin/site-content") return `ניהול תוכן האתר | ${base}`;
      if (pathname === "/admin/profile-update-requests") return `בקשות לעדכון פרופיל | ${base}`;
      
      // Volunteer section
      if (pathname === "/volunteer") return `אזור מתנדב | ${base}`;
      if (pathname === "/volunteer/report/new") return `דיווח על מפגש | ${base}`;
      if (pathname === "/volunteer/reports") return `היסטוריית דיווחים | ${base}`;
      if (pathname === "/volunteer/tasks") return `משימות מתנדב | ${base}`;
      if (pathname === "/volunteer/profile") return `פרופיל אישי | ${base}`;
      
      return base;
    };

    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);

  return (
    <>
    <PublicAutoLogout />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/our-work/:slug" element={<ActivityDetail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/public-gallery" element={<PublicGallery />} />

      {/* Legacy redirect — single login button only */}
      <Route path="/volunteer/login" element={<Navigate to="/login" replace />} />

      <Route path="/admin" element={<Admin><Dashboard /></Admin>} />
      <Route path="/admin/elderly" element={<Admin><Elderly /></Admin>} />
      <Route path="/admin/elderly-contacts" element={<Admin><ElderlyContacts /></Admin>} />
      <Route path="/admin/elderly/:id" element={<Admin><ElderlyProfile /></Admin>} />
      <Route path="/admin/volunteers" element={<Admin><Volunteers /></Admin>} />
      <Route path="/admin/organizations-contacts" element={<Admin><Organizations /></Admin>} />

      <Route path="/admin/projects" element={<Admin><Projects /></Admin>} />
      <Route path="/admin/parliaments" element={<Admin><Parliaments /></Admin>} />
      <Route path="/admin/media" element={<Admin><Media /></Admin>} />
      <Route path="/admin/links" element={<Admin><Links /></Admin>} />
      <Route path="/admin/financial" element={<Admin><Financial /></Admin>} />
      <Route path="/admin/reports" element={<Admin><Reports /></Admin>} />
      <Route path="/admin/volunteer-reports" element={<Admin><VolunteerReports /></Admin>} />
      <Route path="/admin/settings" element={<Admin><RequireReauth scope="settings" title="הגדרות" description={SETTINGS_DESC}><Settings /></RequireReauth></Admin>} />
      <Route path="/admin/site-content" element={<Admin><RequireReauth scope="site-content" title="ניהול אתר ראשי" description={SITE_CONTENT_DESC}><SiteContent /></RequireReauth></Admin>} />
      <Route path="/admin/profile-update-requests" element={<Admin><ProfileUpdateRequests /></Admin>} />
      <Route path="/admin/profile" element={<Admin><AdminProfile /></Admin>} />


      <Route path="/volunteer" element={<Vol><VolunteerDashboard /></Vol>} />
      <Route path="/volunteer/report/new" element={<Vol><VolunteerReportForm /></Vol>} />
      <Route path="/volunteer/reports" element={<Vol><VolunteerReportsHistory /></Vol>} />
      <Route path="/volunteer/tasks" element={<Vol><VolunteerTasks /></Vol>} />
      <Route path="/volunteer/profile" element={<Vol><VolunteerProfile /></Vol>} />
    </Routes>
    </>
  );
}