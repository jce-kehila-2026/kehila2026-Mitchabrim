import { lazy, Suspense, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import "./App.css";
import "./styles/public.css";
import "./styles/admin.css";
import "./styles/volunteer.css";
import "./styles/Login.css";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireReauth from "./components/RequireReauth.jsx";
import PublicAutoLogout from "./components/PublicAutoLogout.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import OfflineBanner from "./components/common/OfflineBanner.jsx";

const SITE_CONTENT_DESC = "אזור זה שולט בתוכן האתר הציבורי — טקסטים בדף הבית, שותפים, כותרות גלריה, תוכן יצירת קשר ומידע הפוטר. שינויים כאן עלולים להשפיע על מה שהמבקרים רואים באתר הציבורי.";
const SETTINGS_DESC = "אזור זה שולט בהגדרות המערכת, משתמשים, הרשאות ונתוני ניהול חשובים. שינויים כאן עלולים להשפיע על גישה ועל התנהגות המערכת.";

const Home = lazy(() => import("./pages/Home.jsx"));
const ActivityDetail = lazy(() => import("./pages/ActivityDetail.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const PublicGallery = lazy(() => import("./pages/PublicGallery.jsx"));
const AdminProfile = lazy(() => import("./pages/AdminProfile.jsx"));

const Dashboard = lazy(() => import("./admin/Dashboard.jsx"));
const Elderly = lazy(() => import("./admin/Elderly.jsx"));
const ElderlyProfile = lazy(() => import("./admin/ElderlyProfile.jsx"));
const Volunteers = lazy(() => import("./admin/Volunteers.jsx"));
const Projects = lazy(() => import("./admin/Projects.jsx"));
const Parliaments = lazy(() => import("./admin/Parliaments.jsx"));
const Media = lazy(() => import("./admin/Media.jsx"));
const Links = lazy(() => import("./admin/Links.jsx"));
const Financial = lazy(() => import("./admin/Financial.jsx"));
const Reports = lazy(() => import("./admin/Reports.jsx"));
const VolunteerReports = lazy(() => import("./admin/VolunteerReports.jsx"));
const Settings = lazy(() => import("./admin/Settings.jsx"));
const SiteContent = lazy(() => import("./admin/SiteContent.jsx"));
const ProfileUpdateRequests = lazy(() => import("./admin/ProfileUpdateRequests.jsx"));
const ElderlyContacts = lazy(() => import("./admin/ElderlyContacts.jsx"));
const Organizations = lazy(() => import("./admin/Organizations.jsx"));

const VolunteerDashboard = lazy(() => import("./volunteer/VolunteerDashboard.jsx"));
const VolunteerReportForm = lazy(() => import("./volunteer/VolunteerReportForm.jsx"));
const VolunteerReportsHistory = lazy(() => import("./volunteer/VolunteerReportsHistory.jsx"));
const VolunteerTasks = lazy(() => import("./volunteer/VolunteerTasks.jsx"));
const VolunteerProfile = lazy(() => import("./volunteer/VolunteerProfile.jsx"));

const Admin = ({ children }) => (
  <ProtectedRoute allow={["admin"]}>{children}</ProtectedRoute>
);
const Vol = ({ children }) => (
  <ProtectedRoute allow={["volunteer", "admin"]}>{children}</ProtectedRoute>
);

const RouteFallback = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      minHeight: "60vh",
      display: "grid",
      placeItems: "center",
      color: "var(--color-text-muted)",
    }}
  >
    טוען...
  </div>
);

function RouteBoundary({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname} scope="route">
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  useEffect(() => {
    // حقن أيقونة إمكانية الوصول (UserWay) 
    // تأخير التحميل لثانية ونصف لتحسين أداء الموقع
    const timer = setTimeout(() => {
      if (!document.getElementById("userway-script")) {
        const script = document.createElement("script");
        script.id = "userway-script";
        script.src = "https://cdn.userway.org/widget.js";
        
        // الحساب الفعال للأيقونة
        script.setAttribute("data-account", "v82XqLOMxV");
        script.setAttribute("data-position", "5");
        // تغيير اللون للعنابي الخاص بمنظمة متحبريم
        script.setAttribute("data-color", "#8b2c2c"); 
        
        script.async = true;
        document.body.appendChild(script);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);
  return (
    <>
    <OfflineBanner />
    <PublicAutoLogout />
    <RouteBoundary>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </RouteBoundary>
    </>
  );
}
