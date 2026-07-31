import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getReportsForAuthUid } from "@/services/reportsService";
import { getTasksForVolunteer, getTasksForAuthUid } from "@/services/tasksService";
import {
  Handshake, Send, CheckCircle2, FilePlus, ClipboardList, ListChecks, UserCog,
  User, MapPin, UserCheck, ListTodo,
} from "lucide-react";

const OPEN_TASK_STATUSES = new Set(["open", "in_progress"]);

const mergeByDocumentId = (...lists) => Array.from(
  new Map(lists.flat().map((item) => [item.id, item])).values(),
);

const isCompletedMeetingReport = (report) => {
  if (Object.prototype.hasOwnProperty.call(report, "wasMeetingHeld")) {
    return report.wasMeetingHeld === true || report.wasMeetingHeld === "כן";
  }
  // In the current schema, submitting a report records a completed interaction.
  return Boolean(report.reportDate);
};

async function loadCurrentVolunteerTasks({ authUid, volunteerId }) {
  const requests = [getTasksForAuthUid(authUid)];
  if (volunteerId) requests.push(getTasksForVolunteer(volunteerId));

  const results = await Promise.allSettled(requests);
  const successfulLists = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  results
    .filter((result) => result.status === "rejected")
    .forEach((result) => {
      console.warn("Volunteer dashboard task query failed:", result.reason);
    });

  if (successfulLists.length === 0) {
    throw results[0]?.reason || new Error("Volunteer tasks could not be loaded");
  }
  return mergeByDocumentId(...successfulLists);
}

export default function VolunteerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { volunteer, loading, error } = useCurrentVolunteer();
  const [reports, setReports] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [statsErrors, setStatsErrors] = useState({ reports: "", tasks: "" });

  const fullName =
    volunteer?.name ||
    [volunteer?.firstName, volunteer?.lastName].filter(Boolean).join(" ") ||
    "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setReports(null);
      setTasks(null);
      setStatsErrors({ reports: "", tasks: "" });

      const [reportsResult, tasksResult] = await Promise.allSettled([
        getReportsForAuthUid(user.uid),
        loadCurrentVolunteerTasks({
          authUid: user.uid,
          volunteerId: volunteer?.id,
        }),
      ]);
      if (cancelled) return;

      const nextErrors = { reports: "", tasks: "" };
      if (reportsResult.status === "fulfilled") {
        setReports(reportsResult.value);
      } else {
        console.error("Volunteer dashboard reports load failed:", reportsResult.reason);
        setReports([]);
        nextErrors.reports = "לא ניתן לטעון את נתוני הדוחות כרגע.";
      }

      if (tasksResult.status === "fulfilled") {
        setTasks(tasksResult.value);
      } else {
        console.error("Volunteer dashboard tasks load failed:", tasksResult.reason);
        setTasks([]);
        nextErrors.tasks = "לא ניתן לטעון את נתוני המשימות כרגע.";
      }
      setStatsErrors(nextErrors);
    }
    if (!loading && user?.uid) {
      load().catch((loadError) => {
        console.error("Volunteer dashboard statistics load failed:", loadError);
        if (!cancelled) {
          setReports([]);
          setTasks([]);
          setStatsErrors({
            reports: "לא ניתן לטעון את נתוני הדוחות כרגע.",
            tasks: "לא ניתן לטעון את נתוני המשימות כרגע.",
          });
        }
      });
    }
    return () => { cancelled = true; };
  }, [volunteer?.id, user?.uid, loading]);

  const openTasks = (tasks || []).filter(
    (task) => !task.status || OPEN_TASK_STATUSES.has(task.status),
  ).length;
  const meetingsDone = (reports || []).filter(isCompletedMeetingReport).length;
  const reportsValue = reports === null ? "…" : statsErrors.reports ? "—" : reports.length;
  const meetingsValue = reports === null ? "…" : statsErrors.reports ? "—" : meetingsDone;
  const tasksValue = tasks === null ? "…" : statsErrors.tasks ? "—" : openTasks;

  const summary = [
    { icon: <Handshake size={22} />, label: "מפגשים שבוצעו", value: meetingsValue },
    { icon: <Send size={22} />, label: "דוחות שנשלחו", value: reportsValue },
    { icon: <CheckCircle2 size={22} />, label: "משימות פתוחות", value: tasksValue },
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
    { icon: <ListTodo size={16} />, label: "משימות פתוחות", value: String(tasksValue) },
  ];

  return (
    <VolunteerLayout
      title={fullName ? `שלום ${fullName}` : "שלום, ברוכ/ה הבא/ה"}
      subtitle="כאן תוכל/י לדווח על מפגשים, לראות משימות ולעקוב אחרי הדוחות שלך"
    >
      {error && <div className="vol-alert-error">{error}</div>}
      {(statsErrors.reports || statsErrors.tasks) && (
        <div className="vol-alert-error" role="alert">
          {[statsErrors.reports, statsErrors.tasks].filter(Boolean).join(" ")}
        </div>
      )}

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
          <Link
            to={c.to}
            key={c.to}
            className="vol-nav-card"
            aria-label={`${c.title}: ${c.subtitle}`}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(c.to);
              }
            }}
          >
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
