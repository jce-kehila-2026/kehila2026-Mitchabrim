import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import VolunteerTaskCard from "@/components/volunteer/VolunteerTaskCard.jsx";

const TASKS = [
  { title: "ביקור שבועי", elderly: "מרים לוי", date: "02.06.2026", type: "ביקור בית", status: "פתוח", note: "מבקשת לתאם שעה מראש." },
  { title: "שיחת טלפון לבדיקת שלום", elderly: "יוסף ברקוביץ", date: "03.06.2026", type: "שיחת טלפון", status: "פתוח", note: "" },
];

export default function VolunteerTasks() {
  return (
    <VolunteerLayout title="המשימות שלי" subtitle="משימות ומפגשים שהוקצו לך על ידי הרכזת">
      {TASKS.map((t, i) => <VolunteerTaskCard key={i} {...t} />)}
    </VolunteerLayout>
  );
}
