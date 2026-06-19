import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import VolunteerInfoBar from "@/components/volunteer/VolunteerInfoBar.jsx";
import VolunteerNavCard from "@/components/volunteer/VolunteerNavCard.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getReportsForVolunteer, getReportsForAuthUid } from "@/services/reportsService";
import { getTasksForVolunteer, getTasksForAuthUid } from "@/services/tasksService";

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

  return (
    <VolunteerLayout
      title={fullName ? `שלום ${fullName}, ברוכ/ה הבא/ה` : "שלום, ברוכ/ה הבא/ה"}
      subtitle="כאן תוכל/י לדווח על מפגשים, לראות משימות ולעקוב אחרי הדוחות שלך"
    >
      {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
      <VolunteerInfoBar
        name={fullName || "—"}
        area={volunteer?.area || "—"}
        coordinator={volunteer?.coordinator || "—"}
        tasks={openTasks}
      />

      <div className="vol-nav-cards">
        <VolunteerNavCard to="/volunteer/report/new" icon="📝" title="הגשת דוח מפגש" subtitle="דווח/י על מפגש התנדבות שבוצע" />
        <VolunteerNavCard to="/volunteer/reports" icon="📋" title="הדוחות שלי" subtitle="צפייה בדוחות שכבר נשלחו" />
        <VolunteerNavCard to="/volunteer/tasks" icon="✅" title="המשימות שלי" subtitle="מפגשים ומשימות שהוקצו לך" />
        <VolunteerNavCard to="/volunteer/profile" icon="👤" title="עדכון פרטים אישיים" subtitle="עדכון פרטי קשר בסיסיים" />
      </div>

      <div style={{ height: 24 }} />
      <h3 style={{ marginBottom: 12, fontSize: 18 }}>סיכום</h3>
      <div className="stats-grid">
        <StatsCard icon="🤝" title="מפגשים שבוצעו" value={String(meetingsDone)} />
        <StatsCard icon="📨" title="דוחות שנשלחו" value={String(reports.length)} />
        <StatsCard icon="✅" title="משימות פתוחות" value={String(openTasks)} />
      </div>
    </VolunteerLayout>
  );
}