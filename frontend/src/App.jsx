import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import "./styles/public.css";
import "./styles/admin.css";
import "./styles/volunteer.css";
import "./styles/Login.css";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
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

import VolunteerDashboard from "./volunteer/VolunteerDashboard.jsx";
import VolunteerReportForm from "./volunteer/VolunteerReportForm.jsx";
import VolunteerReportsHistory from "./volunteer/VolunteerReportsHistory.jsx";
import VolunteerTasks from "./volunteer/VolunteerTasks.jsx";
import VolunteerProfile from "./volunteer/VolunteerProfile.jsx";

const Admin = ({ children }) => (
  <ProtectedRoute allow={["admin"]}>{children}</ProtectedRoute>
);
const Vol = ({ children }) => (
  <ProtectedRoute allow={["volunteer", "admin"]}>{children}</ProtectedRoute>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Legacy redirect — single login button only */}
      <Route path="/volunteer/login" element={<Navigate to="/login" replace />} />

      <Route path="/admin" element={<Admin><Dashboard /></Admin>} />
      <Route path="/admin/elderly" element={<Admin><Elderly /></Admin>} />
      <Route path="/admin/elderly/:id" element={<Admin><ElderlyProfile /></Admin>} />
      <Route path="/admin/volunteers" element={<Admin><Volunteers /></Admin>} />
      <Route path="/admin/projects" element={<Admin><Projects /></Admin>} />
      <Route path="/admin/parliaments" element={<Admin><Parliaments /></Admin>} />
      <Route path="/admin/media" element={<Admin><Media /></Admin>} />
      <Route path="/admin/links" element={<Admin><Links /></Admin>} />
      <Route path="/admin/financial" element={<Admin><Financial /></Admin>} />
      <Route path="/admin/reports" element={<Admin><Reports /></Admin>} />
      <Route path="/admin/volunteer-reports" element={<Admin><VolunteerReports /></Admin>} />
      <Route path="/admin/settings" element={<Admin><Settings /></Admin>} />
      <Route path="/admin/site-content" element={<Admin><SiteContent /></Admin>} />
      <Route path="/admin/profile-update-requests" element={<Admin><ProfileUpdateRequests /></Admin>} />

      <Route path="/volunteer" element={<Vol><VolunteerDashboard /></Vol>} />
      <Route path="/volunteer/report/new" element={<Vol><VolunteerReportForm /></Vol>} />
      <Route path="/volunteer/reports" element={<Vol><VolunteerReportsHistory /></Vol>} />
      <Route path="/volunteer/tasks" element={<Vol><VolunteerTasks /></Vol>} />
      <Route path="/volunteer/profile" element={<Vol><VolunteerProfile /></Vol>} />
    </Routes>
  );
}