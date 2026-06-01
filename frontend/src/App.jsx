import { Routes, Route } from "react-router-dom";
import "./App.css";
import "./styles/public.css";
import "./styles/admin.css";
import "./styles/volunteer.css";
import "./styles/Login.css";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";

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
import Settings from "./admin/Settings.jsx";
import SiteContent from "./admin/SiteContent.jsx";

import VolunteerLogin from "./volunteer/VolunteerLogin.jsx";
import VolunteerDashboard from "./volunteer/VolunteerDashboard.jsx";
import VolunteerReportForm from "./volunteer/VolunteerReportForm.jsx";
import VolunteerReportsHistory from "./volunteer/VolunteerReportsHistory.jsx";
import VolunteerTasks from "./volunteer/VolunteerTasks.jsx";
import VolunteerProfile from "./volunteer/VolunteerProfile.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<Dashboard />} />
      <Route path="/admin/elderly" element={<Elderly />} />
      <Route path="/admin/elderly/:id" element={<ElderlyProfile />} />
      <Route path="/admin/volunteers" element={<Volunteers />} />
      <Route path="/admin/projects" element={<Projects />} />
      <Route path="/admin/parliaments" element={<Parliaments />} />
      <Route path="/admin/media" element={<Media />} />
      <Route path="/admin/links" element={<Links />} />
      <Route path="/admin/financial" element={<Financial />} />
      <Route path="/admin/reports" element={<Reports />} />
      <Route path="/admin/settings" element={<Settings />} />
      <Route path="/admin/site-content" element={<SiteContent />} />

      <Route path="/volunteer/login" element={<VolunteerLogin />} />
      <Route path="/volunteer" element={<VolunteerDashboard />} />
      <Route path="/volunteer/report/new" element={<VolunteerReportForm />} />
      <Route path="/volunteer/reports" element={<VolunteerReportsHistory />} />
      <Route path="/volunteer/tasks" element={<VolunteerTasks />} />
      <Route path="/volunteer/profile" element={<VolunteerProfile />} />
    </Routes>
  );
}
