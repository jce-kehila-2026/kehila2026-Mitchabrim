import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getReportsForVolunteer, getReportsForAuthUid } from "@/services/reportsService";
import { getTasksForVolunteer, getTasksForAuthUid } from "@/services/tasksService";
import {
  Handshake, Send, CheckCircle2, FilePlus, ClipboardList, ListChecks, UserCog,
  User, MapPin, UserCheck, ListTodo,
} from "lucide-react";

export default function VolunteerDashboard() {
  const { user } = useAuth();
  const { volunteer, loading, error } = useCurrentVolunteer();
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);

  const fullName =
    volunteer?.name ||
    [volunteer?.firstName, volunteer?.lastName].filter(Boolean).join(" ") ||
    "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let r = [];
        let t = [];
        if (volunteer?.id) {
          r = await getReportsForVolunteer(volunteer.id);
          t = await getTasksForVolunteer(volunteer.id);
        }
        if (r.length === 0 && user?.uid) r = await getReportsForAuthUid(user.uid);
        if (t.length === 0 && user?.uid) t = await getTasksForAuthUid(user.uid);
        if (!cancelled) {
          setReports(r);
          setTasks(t);
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (!loading) load();
    return () => { cancelled = true; };
  }, [volunteer?.id, user?.uid, loading]);

  const openTasks = tasks.filter((t) => !t.status || t.status === "open" || t.status === "in_progress").length;
  const meetingsDone = reports.filter((r) => r.wasMeetingHeld === "כן" || r.wasMeetingHeld === true).length || reports.length;

  const summary = [
    { icon: <Handshake size={22} />, label: "מפגשים שבוצעו", value: meetingsDone },
    { icon: <Send size={22} />, label: "דוחות שנשלחו", value: reports.length },
    { icon: <CheckCircle2 size={22} />, label: "משימות פתוחות", value: openTasks },
  ];

  const navCards = [
    { to: "/volunteer/report/new", icon: <FilePlus size={26} />, title: "הגשת דוח מפגש", subtitle: "דווח/י על מפגש התנדבות שבוצע" },
    { to: "/volunteer/reports", icon: <ClipboardList size={26} />, title: "הדוחות שלי", subtitle: "צפייה בדוחות שכבר נשלחו" },
    { to: "/volunteer/tasks", icon: <ListChecks size={26} />, title: "המשימות שלי", subtitle: "מפגשים ומשימות שהוקצו לך" },
    { to: "/volunteer/profile", icon: <UserCog size={26} />, title: "הפרטים שלי", subtitle: "צפייה ובקשה לעדכון פרטים" },
  ];

  const infoItems = [
    { icon: <User size={16} />, label: "שם", value: fullName || "—" },
    { icon: <MapPin size={16} />, label: "אזור פעילות", value: volunteer?.area || volunteer?.neighborhood || "—" },
    { icon: <UserCheck size={16} />, label: "רכזת אחראית", value: volunteer?.coordinator || volunteer?.group || "—" },
    { icon: <ListTodo size={16} />, label: "משימות פתוחות", value: String(openTasks) },
  ];

  return (
    <VolunteerLayout
      title={fullName ? `שלום ${fullName}` : "שלום, ברוכ/ה הבא/ה"}
      subtitle="כאן תוכל/י לדווח על מפגשים, לראות משימות ולעקוב אחרי הדוחות שלך"
    >
      {error && <div className="vol-alert-error">{error}</div>}

      <div className="vol-info-banner">
        {infoItems.map((it, i) => (
          <div key={i} className="vol-info-item">
            <span className="vol-info-icon">{it.icon}</span>
            <div>
              <div className="vol-info-label">{it.label}</div>
              <div className="vol-info-value">{it.value}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="vol-section-title">פעולות מהירות</h3>
      <div className="vol-nav-cards" style={{ marginBottom: 28 }}>
        {navCards.map((c) => (
          <Link to={c.to} key={c.to} className="vol-nav-card">
            <div className="icon">{c.icon}</div>
            <div className="text">
              <h4>{c.title}</h4>
              <p>{c.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>

      <h3 className="vol-section-title">סיכום</h3>
      <div className="vol-summary-grid">
        {summary.map((s, i) => (
          <div key={i} className="vol-summary-card">
            <div className="meta">
              <div className="label">{s.label}</div>
              <div className="value">{String(s.value)}</div>
            </div>
            <div className="icon-bubble">{s.icon}</div>
          </div>
        ))}
      </div>
    </VolunteerLayout>
  );
}
